"use strict";

import { substrait } from "../dist/definitions"

const JOIN_TYPES = [
  "unspecified",
  "inner",
  "outer",
  "left",
  "right",
  "semi",
  "anti",
  "single",
];

interface Field {
    name: string,
    children: Field[],
    type: string,
    nullability: string,
}

interface SimpleProperty{
  name: string,
  value: string 
}
interface PrintNode {
  id: string,
  type: string,
  inputs: PrintNode[],
  props: SimpleProperty[],
  schema: Field,
}

class SubstraitParser {
    
    idCounters: Map<string, number>
    extSet: Map<number, string>

   /**
   * Constructs a SubstraitParser
   * @param {Object} plan the Substrait plan
   */
  constructor(plan:substrait.Plan) {
    this.idCounters = new Map();
    this.extSet = this.buildExtensionSet(plan);
  }

  /**
   * Creates a map from anchor to function name
   * @param {Object} plan the Substrait plan
   * @return {Map<number, string>} the created mapping
   */
  buildExtensionSet(plan:substrait.Plan) {
    const extSet = new Map();
    const urisMap = new Map();
    for (const extensionUri of plan.extensionUris) {
      urisMap.set(extensionUri.extensionUriAnchor, extensionUri.uri);
    }
    for (const extensionDecl of plan.extensions) {
      if (extensionDecl.extensionFunction) {
        const func = extensionDecl.extensionFunction;
        const name = func.name?.substring(0, func.name.indexOf(":"));
        // TODO(weston) find some way to make URIs expandable
        // const uri = urisMap.get(func.extensionUriReference);
        extSet.set(func.functionAnchor, `${name}`);
      }
    }
    return extSet;
  }

  /**
   * Generate a unique id for the node
   * @param {string} type The type of the node
   * @return {string} A unique id
   */
  nextId(type:string): string {
    if (!this.idCounters.has(type)) {
      this.idCounters.set(type, 0);
    }
    const value = this.idCounters.get(type);
    if(value){
        this.idCounters.set(type, value + 1);
    }
    return `${type}_${value}`;
  }

  /**
   * A generic, potentially nested, key/value object
   * @typedef {Object} SimpleProperty
   * @property {string} name the name of the property
   * @property {(boolean|string|number|SimpleProperty[])} value the
   *     value of the property, may be recursive to form a tree of
   *     key/value pairs.
   */

  /**
   * A named field
   * @typedef {Object} Field
   * @param {string} name the name of the field
   * @param {Field[]} children the children of the field
   * @param {string} type the data type of the field
   * @param {string} nullable whether or not the field is nullable
   *     One of 'unspecified', 'nullable', 'required' or 'unknown'
   */

  /**
   * A node in a print tree
   *
   * A print tree is a simplified representation of a Substrait plan.
   * This is not a round-trippable representation and fidelity is lost
   * when converting to this form.  It is intended to be an easily consumed
   * representation of a tree of nodes that any tool can visualize.
   *
   * A print tree will maintain the output schema of the node at each step.
   *
   * The schema of a node is a special Field instance.  The name and type
   * are empty strings.  It has children.  The nullability is unspecified.
   *
   * @typedef {Object} PrintNode
   * @param {string} id a unique identifier for the node
   * @param {string} type the node type (i.e. the relational operator)
   * @param {PrintNode[]} inputs the inputs to the node
   * @param {SimpleProperty} props properties describing the node
   * @param {Field} schema the output schema of the node
   */

  /**
   * Create a schema field
   *
   * This is a special field with an empty name and an empty type string
   * and uknown nullability
   *
   * @param {Field[]} fields the fields of the schema
   * @return {Field} a schema field
   */
  makeSchemaField(fields:Field[]):Field {
    return {
      name: "",
      children: fields,
      type: "",
      nullability: "unspecified",
    };
  }

  /**
   * Applies a Substrait emit to an output schema
   * @param {Field} schema the original output schema
   * @param {Object} emit a potential remapping of fields
   * @return {Field} the remapped output schema
   */
  applyEmit(schema:Field, emit:substrait.RelCommon.IEmit | null):Field {
    let outputFields = schema.children;
    if (emit && emit.outputMapping) {
      outputFields = emit.outputMapping.map((idx:number) => schema.children[idx]);
    }
    return this.makeSchemaField(outputFields);
  }

  /**
   * Create a print node, generating a new id
   *
   * @param {string} type the node type
   * @param {PrintNode[]} inputs the inputs to the node
   * @param {SimpleProperty[]} props properties describing the node
   * @param {Field} schema the output schema of the node
   * @param {Object} emit the Substrait emit for the node
   * @return {PrintNode} a print node
   */
  makePrintNode(type:string, inputs:PrintNode[], props:SimpleProperty[], schema:Field, emit:substrait.RelCommon.IEmit | null):PrintNode {
    const emitSchema = this.applyEmit(schema, emit);
    return {
      id: this.nextId(type),
      type,
      inputs,
      props,
      schema: emitSchema,
    };
  }

  /**
   * Recursive helper for structFieldToStr
   * @param {*} field the Substrait field to convert
   * @param {*} currentName the current name
   * @param {*} currentField the current input field
   * @return {Field} a stringified represenstation
   */
  structFieldHelper(field:substrait.Expression.ReferenceSegment.IStructField, currentName:string, currentField:Field):Field {
    if(!field.field){
      throw new Error("fieldNum cannot be defined to convert "+currentName)
    }
    const fieldNum = field.field;
    const fieldName = currentField.name ? currentField.name : `$${fieldNum}`;
    if(!fieldName){
      throw new Error("FieldName cannot be defined to convert "+currentName)
    }
    const nextName = `${currentName}${fieldName}`;
    if (field.child) {
      if(!field.child.structField){
        throw new Error("Field " + fieldName + "child has undefined struct field")
      }
      return this.structFieldHelper(
        field.child.structField,
        `${nextName}.`,
        currentField.children[fieldNum]
      );
    }
    return currentField.children[fieldNum];
  }

  /**
   * Convert a struct field to a stringified representation
   *
   * Struct fields are usually intuitively written with names.
   * For example, a.b.c.   However, fields in Substrait plans
   * are not typically named.  So instead we represent them as
   * $0, $1, $2, ... where $N means the field at index N.
   *
   * If the field does happen to be named we will use that.
   *
   * @param {Object} field a Substrait struct field
   * @param {Object} exprIn the input to the expression
   * @return {Field} a stringified representation
   */
  structFieldToField(field:substrait.Expression.ReferenceSegment.IStructField, exprIn:Field) {
    return this.structFieldHelper(field, "", exprIn);
  }

  /**
   * Convert a direct reference to a stringified representation
   * @param {Object} ref A Substrait direct reference
   * @param {Object} exprIn the input to the expression
   * @return {Field} a string representation
   */
  directReferenceToField(ref:substrait.Expression.IReferenceSegment, exprIn:Field) :Field {
    if (ref.structField) {
      return this.structFieldToField(ref.structField, exprIn);
    } else {
      throw new Error(`Unrecognized direct reference: ${ref}`);
    }
  }

  /**
   * Convert a reference to a stringified representation
   * @param {Object} ref A Substrait reference expression
   * @param {Object} exprIn the input to the expression
   * @return {Field} a string representation
   */
  referenceToField(ref:substrait.Expression.IFieldReference, exprIn:Field):Field {
    if (ref.directReference) {
      return this.directReferenceToField(ref.directReference, exprIn);
    } else {
      throw new Error(`Unrecognized reference: ${ref}`);
    }
  }

  /**
   * Convert a Substrait function argument to a string
   * @param {Object} arg the argument to convert
   * @param {Field} inp the input field
   * @return {string} a string representation
   */
  functionArgumentToStr(arg:substrait.IFunctionArgument, inp:Field):string {
    if (arg.enum) {
      return arg.enum;
    } else if (arg.type) {
      return this.typeToField(arg.type).type;
    } else if (arg.value) {
      return this.expressionToStr(arg.value, inp).name;
    } else {
      throw new Error("A FunctionArgument did not have an enum/type/value");
    }
  }

  /**
   * Converts a Substrait function reference to a string
   * @param {number} ref a Substrait function reference
   * @param {Map<string,string>} extSet an extension set
   * @return {string} a string version of the reference
   */
  functionRefToName(ref:number): string {
    if (this.extSet.has(ref)) {
      return this.extSet.has(ref) ? (this.extSet.get(ref) || '') : '';
    }
    return "unknown";
  }

  /**
   * Convert arguments to a joined string
   * @param {Object} func A Substrait function call
   * @param {Field} schema The input type
   * @return {string} A string representation
   */
  argsToString(func:substrait.Expression.IScalarFunction, schema:Field): string {
    let args:string[] = [];
    if (func.arguments && func.arguments.length > 0) {
      args = func.arguments.map((arg) =>
        this.functionArgumentToStr(arg, schema)
      );
    }
    return args.join(",");
  }

  /**
   * Convert a scalar function to a stringified representation
   * @param {Object} func the function to convert
   * @param {Field} schema the input type info
   * @return {Field} a string version of the function
   */
  scalarFunctionToField(func:substrait.Expression.IScalarFunction, schema:Field):Field {
    const argsString = this.argsToString(func, schema);
    if(!func.outputType){
      throw new Error("Function to convert has undefined output type")
    }
    const outputType = this.typeToField(func.outputType);
    if(!func.functionReference){
      throw new Error("Function to convert has undefined reference")
    }
    const functionName = this.functionRefToName(func.functionReference);
    const fieldName = `${functionName}(${argsString})`;
    outputType.name = fieldName;
    return outputType;
  }

  /**
   * Converts a Substrait literal to a field
   * @param {Object} lit the Substrait literal
   * @return {Field} a field representation
   */
  literalToField(lit:substrait.Expression.ILiteral) {
    let nullability = "required";
    if (lit.nullable) {
      nullability = "nullable";
    }
    if (this.hasValue(lit, "bool")) {
      return {
        name: lit.boolean ? "true" : "false",
        type: "boolean",
        nullability,
        children: [],
      };
    } else if (lit.date) {
      return {
        name: new Date(lit.date * 8.64e7).toISOString(),
        type: "date",
        nullability,
        children: [],
      };
    } else if (lit.i32) {
      return {
        name: lit.i32.toString(),
        type: "i32",
        nullability,
        children: [],
      };
    } else if (lit.intervalDayToSecond) {
      const val = lit.intervalDayToSecond;
      return {
        name: `${val.days}d${val.seconds}s${val.microseconds}u`,
        type: "interval_day",
        nullability,
        children: [],
      };
    } else {
      throw new Error(`Unrecognized literal: ${JSON.stringify(lit)}`);
    }
  }

  /**
   * Convert a cast expression to a stringified representation
   * @param {Object} cast A Substrait cast expression
   * @param {Field} schema The input schema
   * @return {Field} A field representation
   */
  castToField(cast:substrait.Expression.ICast, schema:Field):Field {
    if(!cast.input){
      throw new Error("Cast expression has undefined input")
    }
    if(!cast.type){
      throw new Error("Cast expression has undefined output type")
    }
    const input = this.expressionToStr(cast.input, schema);
    const outputType = this.typeToField(cast.type);
    let fb = "unspecified";
    if (cast.failureBehavior === 1) {
      fb = "or null";
    } else if (cast.failureBehavior === 2) {
      fb = "or die";
    }
    const name = `cast(${input.name}, ${outputType.type}, ${fb})`;
    outputType.name = name;
    return outputType;
  }

  /**
   * Convert an expression to a stringified representation
   *
   * The expression is returned as a field where the type
   * of the field is the output type of the expression and the
   * name of the field is a string representation of the expression
   *
   * @param {Object} expr A Substrait expression
   * @param {Object} exprIn the input to the expression
   * @return {Field} a string representation
   */
  expressionToStr(expr:substrait.IExpression, exprIn:Field) {
    if (expr.selection) {
      return this.referenceToField(expr.selection, exprIn);
    } else if (expr.scalarFunction) {
      return this.scalarFunctionToField(expr.scalarFunction, exprIn);
    } else if (expr.literal) {
      return this.literalToField(expr.literal);
    } else if (expr.cast) {
      return this.castToField(expr.cast, exprIn);
    } else {
      throw new Error(`Unrecognized expression: ${JSON.stringify(expr)}`);
    }
  }

  /**
   * Convert a project relation to a print node
   * @param {Object} project A Substrait ProjectRel
   * @return {PrintNode} a print node
   */
  projectToNode(project:substrait.IProjectRel):PrintNode {
    if(!project.input){
      throw new Error("Project rel has undefined input")
    }
    const input = this.relToNode(project.input);
    const expressions = project.expressions?.map((val:substrait.IExpression, idx:number) => {
      return {
        name: `expressions[${idx}]`,
        field: this.expressionToStr(val, input.schema),
      };
    });
    const outFields = expressions?.map((expr:{name:string, field: Field}) => expr.field);
    const fields = input.schema.children.concat(outFields ?? []);
    const schema = this.makeSchemaField(fields);
    let props:SimpleProperty[] = [];
    if(expressions){
      props = expressions.map((expr:{name:string, field: Field}) => ({
        name: expr.name,
        value: expr.field.name,
      }));
    }
    return this.makePrintNode(
      "project",
      [input],
      props,
      schema,
      project.common?.emit ?? null
    );
  }

  /**
   * Convert a Substrait data type to an unnamed Field
   *
   * The field's name will be an empty string
   *
   * @param {Object} type a Substrait data type
   * @return {Field} an unnamed field
   */
  typeToField(type:substrait.IType):Field {
    let typeStr:string;
    let nullability:substrait.Type.Nullability;
    if (type.varchar) {
      typeStr = `VARCHAR<${type.varchar.length}>`;
      nullability = type.varchar.nullability ?? substrait.Type.Nullability.NULLABILITY_UNSPECIFIED;
    } else if (type.fixedChar) {
      typeStr = `FIXEDCHAR<${type.fixedChar.length}>`;
      nullability = type.fixedChar.nullability ?? substrait.Type.Nullability.NULLABILITY_UNSPECIFIED;
    } else if (type.date) {
      typeStr = "date";
      nullability = type.date.nullability ?? substrait.Type.Nullability.NULLABILITY_UNSPECIFIED;
    } else if (type.decimal) {
      typeStr = `DECIMAL<${type.decimal.precision},${type.decimal.scale}>`;
      nullability = type.decimal.nullability ?? substrait.Type.Nullability.NULLABILITY_UNSPECIFIED;
    } else if (type.i32) {
      typeStr = "i32";
      nullability = type.i32.nullability ?? substrait.Type.Nullability.NULLABILITY_UNSPECIFIED;
    } else if (type.i64) {
      typeStr = "i64";
      nullability = type.i64.nullability ?? substrait.Type.Nullability.NULLABILITY_UNSPECIFIED;
    } else if (type.bool) {
      typeStr = "boolean";
      nullability = type.bool.nullability ?? substrait.Type.Nullability.NULLABILITY_UNSPECIFIED;
    } else if (type.string) {
      typeStr = "string";
      nullability = type.string.nullability ?? substrait.Type.Nullability.NULLABILITY_UNSPECIFIED;
    } else {
      throw new Error(`Unrecognized type: ${JSON.stringify(type)}`);
    }
    let nullabilityStr = "";
    if (nullability == 0) {
      nullabilityStr = "unspecified";
    } else if (nullability == 1) {
      nullabilityStr = "nullable";
    } else if (nullability == 2) {
      nullabilityStr = "required";
    } else {
      throw new Error(`Unrecognized nullability: ${nullability}`);
    }
    return {
      name: "",
      type: typeStr,
      nullability: nullabilityStr,
      children: [],
    };
  }

  /**
   * Convert a named struct to an array of Field
   * @param {Object} struct a Substrait named struct
   * @return {Field[]} named fields
   */
  namedStructToSchema(struct:substrait.INamedStruct):Field {
    const names = struct.names;
    const types = struct.struct?.types;
    if (names?.length != types?.length) {
      throw new Error("NamedStruct must have one type for each name");
    }
    const outTypes:Field[] = [];
    for (let i = 0; i < (names?.length ?? 0); i++) {
      if(types?.[i]){
        const type = this.typeToField(types?.[i]);
        type.name = names?.[i] ?? '';
        outTypes.push(type);
      }
    }
    return this.makeSchemaField(outTypes);
  }

  /**
   * Extract the properties from a read relation
   * @param {Object} read a Substrait read relation
   * @return {SimpleProperty[]} properties for the relation
   */
  readTypeToProps(read:substrait.IReadRel):SimpleProperty[] {
    if (read.namedTable) {
      const tableName = read.namedTable.names?.join(".");
      return [{ name: "namedTable.names", value: tableName ?? ""}];
    } else {
      throw new Error(`Unrecognized read type: ${JSON.stringify(read)}`);
    }
  }

  /**
   * Convert a Substrait read relation to a print node
   * @param {Object} read a Substrait read relation
   * @return {PrintNode} a print node
   */
  readToNode(read:substrait.IReadRel):PrintNode {
    if(!read.baseSchema){
      throw new Error("Read relation has undefined base schema")
    }
    const schema = this.namedStructToSchema(read.baseSchema);
    const props = this.readTypeToProps(read);
    return this.makePrintNode("read", [], props, schema, read.common?.emit ?? null);
  }

  /**
   * True if the object has a field with the given name
   * @param {Object} obj the object to test
   * @param {string} fieldName the field name to look for
   * @return {boolean} the result of the test
   */
  hasValue(obj: any, fieldName: string): boolean {
    // Technically `undefined` shouldn't be possible because
    // of how protobuf works but it can't hurt to check;
    return obj[fieldName] !== null && obj[fieldName] !== undefined;
  }

  /**
   * Convert a Substrait fetch relation to a print node
   * @param {Object} fetch a Substrait fetch relation
   * @return {PrintNode} a print node
   */
  fetchToNode(fetch:substrait.IFetchRel):PrintNode {
    if(!fetch.input){
      throw new Error("Fetch relation has undefined input")
    }
    const input = this.relToNode(fetch.input);
    const schema = input.schema;
    const props: SimpleProperty[]= [];
    if (this.hasValue(fetch, "offset")) {
      props.push({ name: "offset", value: fetch.offset?.toString() ?? "" });
    }
    if (this.hasValue(fetch, "count")) {
      props.push({ name: "count", value: fetch.count?.toString() ?? "" });
    }
    return this.makePrintNode(
      "fetch",
      [input],
      props,
      schema,
      fetch.common?.emit ?? null
    );
  }

  /**
   * Convert a Substrait sort field to a property
   * @param {Object} sortField a Substrait sort field
   * @param {Field} schema the schema of the sort input
   * @return {SimpleProperty} a property describing the sort
   */
  sortFieldToStr(sortField:substrait.ISortField, schema:Field):SimpleProperty {
    if(!sortField.expr){
      throw new Error("Sort field expression has undefined name")
    }
    const exprStr = this.expressionToStr(sortField.expr, schema).name;
    if (sortField.direction) {
      const dir = sortField.direction;
      let sortDesc = "";
      switch(+dir){
        case substrait.SortField.SortDirection.SORT_DIRECTION_UNSPECIFIED: {
          sortDesc = "unspecified";
          break;
        }
        case substrait.SortField.SortDirection.SORT_DIRECTION_ASC_NULLS_FIRST: {
          sortDesc = "ascending (nulls first)";
          break;
        } 
        case substrait.SortField.SortDirection.SORT_DIRECTION_ASC_NULLS_LAST: {
          sortDesc = "ascending (nulls last)";
          break;
        }
        case substrait.SortField.SortDirection.SORT_DIRECTION_DESC_NULLS_FIRST: {
          sortDesc = "descending (nulls first)";
          break;
        }
        case substrait.SortField.SortDirection.SORT_DIRECTION_DESC_NULLS_LAST: {
          sortDesc = "descending (nulls last)";
          break;
        }
        case substrait.SortField.SortDirection.SORT_DIRECTION_CLUSTERED: {
          sortDesc = "clustered";
          break;
        }
        default:
          throw new Error(`Unrecognized sort direction: ${dir}`);
      }
      return {name: exprStr, value: sortDesc};
    } else {
      throw new Error("Sort field lacks direction");
    }
  }

  /**
   * Convert a Substrait sort relation to a print node
   * @param {Object} sort a Substrait sort relation
   * @return {PrintNode} a print node
   */
  sortToNode(sort:substrait.ISortRel):PrintNode {
    if(!sort.input){
      throw new Error("Aggregate relation has undefined input")
    }
    const input = this.relToNode(sort.input);
    const schema = input.schema;
    let props:SimpleProperty[] = [];
    if(sort.sorts){
      props = sort.sorts?.map((sort) => {
        return this.sortFieldToStr(sort, schema)
      });
    }
    return this.makePrintNode("sort", [input], props, schema, sort.common?.emit ?? null);
  }

  /**
   * Convert a Substrait aggregate function to a field
   * @param {Object} func the Substrait aggregate function
   * @param {Field} inp the input field
   * @return {Field} a field representation of the function
   */
  aggregateFunctionToField(func:substrait.IAggregateFunction, inp:Field):Field {
    // TODO (weston) sorts, phases, invocation
    return this.scalarFunctionToField(func, inp);
  }

  /**
   * Convert a Substrait aggregate relation to a print node
   * @param {Object} agg a Substrait aggregate relation
   * @return {PrintNode} a print node
   */
  aggToNode(agg:substrait.IAggregateRel):PrintNode {
    if(!agg.input){
      throw new Error("Aggregate relation has undefined input")
    }
    const input = this.relToNode(agg.input);
    const props: SimpleProperty[] = [];
    const fields: Field[] = [];
    if(!agg.groupings){
      throw new Error("Aggregate relation has undefined groupings")
    }
    agg.groupings.forEach((grouping, idx) => {
      for (const groupingExpr of grouping.groupingExpressions ?? []) {
        const groupingField = this.expressionToStr(groupingExpr, input.schema);
        props.push({ name: `grouping[${idx}]`, value: groupingField.name });
        fields.push(groupingField);
      }
    });
    agg.measures?.forEach((measure, idx) => {
      const innerProps:SimpleProperty[] = []
      if(measure.measure){
        const aggregate = this.aggregateFunctionToField(
          measure.measure,
          input.schema
        );
        fields.push(aggregate);
        innerProps.push(       {
          name: "measure",
          value: aggregate.name,
        });
      }
      if (measure.filter) {
        innerProps.push({
          name: "filter",
          value: this.expressionToStr(measure.filter, input.schema).name,
        });
      }
      innerProps.forEach((innerProp) =>{
        props.push({
          name: `measures[${idx}][${innerProp.name}]`,
          value: innerProp.value,
        });
      })
    });
    const schema = this.makeSchemaField(fields);
    return this.makePrintNode(
      "aggregate",
      [input],
      props,
      schema,
      agg.common?.emit ?? null
    );
  }

  /**
   * Convert a Substrait filter relation to a print node
   * @param {Object} filt a Substrait filter relation
   * @return {PrintNode} a print node
   */
  filterToNode(filt:substrait.IFilterRel):PrintNode {
    const input = filt.input ? this.relToNode(filt.input) : undefined;

    if (input === undefined) {
      throw new Error("Filter input is null or undefined");
    }
    
    const props: SimpleProperty[]= [];
    const schema = input.schema;
    if (filt.condition) {
      props.push({
        name: "condition",
        value: this.expressionToStr(filt.condition, schema).name,
      });
    }
    return this.makePrintNode(
      "filter",
      [input],
      props,
      schema,
      filt.common?.emit ?? null
    );
  }

  /**
   * Converts a Substrait join relation to a print node
   * @param {Object} join a Substrait join relation
   * @return {PrintNode} a print node
   */
  joinToNode(join:substrait.IJoinRel):PrintNode {
    const left = join.left ? this.relToNode(join.left) : undefined;
    const right = join.right ? this.relToNode(join.right) : undefined;
    
    if (left === undefined || right === undefined) {
      throw new Error("Join nodes are null or undefined");
    }

    const props: SimpleProperty[] = [];
    const schema = this.makeSchemaField(
      left.schema.children.concat(right.schema.children)
    );
    let joinType = "unspecified";
    if (join.type) {
      joinType = JOIN_TYPES[join.type];
    }
    props.push({ name: "type", value: joinType });
    if (join.expression) {
      const exprStr = this.expressionToStr(join.expression, schema).name;
      props.push({ name: "expression", value: exprStr });
    }
    return this.makePrintNode(
      "join",
      [left, right],
      props,
      schema,
      join.common?.emit ?? null
    );
  }

  /**
   * Converts a Substrait relation to a print node
   * @param {Object} rel the Substrait relation to convert
   * @return {PrintNode} a print node
   */
  relToNode(rel:substrait.IRel):PrintNode {
    if (rel.project) {
      return this.projectToNode(rel.project);
    } else if (rel.read) {
      return this.readToNode(rel.read);
    } else if (rel.fetch) {
      return this.fetchToNode(rel.fetch);
    } else if (rel.sort) {
      return this.sortToNode(rel.sort);
    } else if (rel.aggregate) {
      return this.aggToNode(rel.aggregate);
    } else if (rel.filter) {
      return this.filterToNode(rel.filter);
    } else if (rel.join) {
      return this.joinToNode(rel.join);
    } else {
      throw new Error(`Unrecognized relation: ${JSON.stringify(rel)}`);
    }
  }

  /**
   * Converts a Substrait root relation to a print node
   * @param {Object} rel the Substrait relation to convert
   * @return {PrintNode} a print node
   */
  rootRelToNode(rel:substrait.IRelRoot):PrintNode {
    const props:SimpleProperty[] =[]
    if(rel.names != undefined){
      rel.names.map((val, idx) => ({
        name: `name[${idx}]`,
        value: val,
      }));
    } 
    if (rel.input === undefined || rel.input === null){
      throw new Error("Root relation input was undefined or null")
    } else {
      const inputs = [this.relToNode(rel.input)];
      const schema = this.makeSchemaField([]);
      return this.makePrintNode("sink", inputs, props, schema, null);
  }
  }

  /**
   * Converts a Substrait plan to a print node
   * @param {Object} plan the Substrait plan to convert
   * @return {PrintNode} a print node
   */
  planToNode(plan:substrait.Plan):PrintNode {
    const nodes: PrintNode[] = [];
    for (const relation of plan.relations) {
      if (relation.root) {
        nodes.push(this.rootRelToNode(relation.root));
      } else {
        throw new Error(`Unrecognized plan relation ${JSON.stringify(relation)}`);
      }
    }
    const schema = this.makeSchemaField([]);
    return this.makePrintNode("plan", nodes, [], schema, null);
  }
}

module.exports = {
  SubstraitParser,
};
