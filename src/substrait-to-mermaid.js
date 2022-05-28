const { types } = require("protobufjs");

idCounters = new Map();

function next_id(type) {
    if (!idCounters.has(type)) {
        idCounters.set(type, 0);
    }
    const value = idCounters.get(type);
    idCounters.set(type, value + 1);
    return `${type}_${value}`;
}

function node(type, inputs, props, fields) {
    console.log(`props=${JSON.stringify(props)}`);
    return {
        id: next_id(type), type, inputs, props, fields
    };
}

function nodeToMermaid(node) {
    const fields = node.fields.map(field => `<li>${field.type} ${field.name}</li>`).join('');
    const props = node.props.map(prop => `<li>${prop.name} ${prop.value}</li>`).join('');
    const self_value = `${node.id}["${node.type.toUpperCase()}<br/>Fields<br/><ul>${fields}</ul><br/>Properties<br/><ul>${props}</ul>"]`;
    let combined_value = '';
    for (let input of node.inputs) {
        const input_value = nodeToMermaid(input);
        combined_value += input_value + '\n\n';
    }
    combined_value += self_value + '\n';
    for (let input of node.inputs) {
        combined_value += `${input.id} --> ${node.id}\n`;
    }
    return combined_value;
}

function structFieldToStr(field) {
    const field_num = field.field;
    if ('child' in field && field.child) {
        return `$${field_num}.${referenceToStr(field.child)}`;
    } else {
        return `$${field_num}`;
    }
}

function directReferenceToStr(ref) {
    if ('structField' in ref) {
        return structFieldToStr(ref.structField);
    } else {
        throw new Error(`Unrecognized direct reference: ${ref}`);
    }
}

function referenceToStr(ref) {
    if ('directReference' in ref) {
        return directReferenceToStr(ref.directReference);
    } else {
        throw new Error(`Unrecognized reference: ${ref}`);
    }
}

function expressionToStr(expr) {
    if ('selection' in expr) {
        return referenceToStr(expr.selection);
    } else {
        throw new Error(`Unrecognized expression: ${expr}`);
    }
}

function projectToNode(project) {
    const props = project.expressions.map((val, idx) => ({ name: `expressions[${idx}]`, value: expressionToStr(val) }));
    const inputs = [relToNode(project.input)]
    return node('project', inputs, props, []);
}

function typeToStr(typ) {
    let type_str = null;
    let nullability = true;
    if (typ.varchar) {
        type_str = `VARCHAR<${typ.varchar.length}>`;
        nullability = typ.varchar.nullability;
    } else if (typ.fixedChar) {
        type_str = `FIXEDCHAR<${typ.fixedChar.length}>`;
        nullability = typ.fixedChar.nullability;
    } else if (typ.date) {
        type_str = 'date';
        nullability = typ.date.nullability;
    } else if (typ.decimal) {
        type_str = `DECIMAL<${typ.decimal.precision},${typ.decimal.scale}>`;
        nullability = typ.decimal.nullability;
    } else if (typ.i32) {
        type_str = 'i32';
        nullability = typ.i32.nullability;
    } else if (typ.i64) {
        type_str = 'i64';
        nullability = typ.i64.nullability;
    } else {
        throw new Error(`Unrecognized type: ${JSON.stringify(typ)}`);
    }
    if (nullability == 0) {
        return type_str;
    } else if (nullability == 1) {
        return `${type_str} NULL`;
    } else if (nullability == 2) {
        return `${type_str} NOT NULL`;
    } else {
        throw new Error(`Unrecognized nullability: ${nullability}`);
    }
}

function namedStructToFields(struct) {
    const names = struct.names;
    const types = struct.struct.types;
    if (names.length != types.length) {
        throw new Error('NamedStruct must have one type for each name');
    }
    const zipped = [];
    for (let i = 0; i < names.length; i++) {
        const type_str = typeToStr(types[i]);
        zipped.push({ name: names[i], type: type_str });
    }
    return zipped;
}

function readTypeToProps(read) {
    if (read.namedTable) {
        const tableName = read.namedTable.names.join('.');
        return [{ name: 'namedTable.names', value: tableName }];
    } else {
        throw new Error(`Unrecognized read type: ${JSON.stringify(read)}`);
    }
}

function readToNode(read) {
    const fields = namedStructToFields(read.baseSchema);
    const props = readTypeToProps(read);
    return node('read', [], props, fields);
}

function relToNode(rel) {
    if (rel.project) {
        return projectToNode(rel.project);
    } else if (rel.read) {
        return readToNode(rel.read);
    } else {
        throw new Error(`Unrecognized relation: ${JSON.stringify(rel)}`);
    }
}

function rootRelToNode(rel) {
    const props = rel.names.map((val, idx) => ({ name: `name[${idx}]`, value: val }));
    const inputs = [relToNode(rel.input)];
    return node('root', inputs, props, []);
}

function planRelationToNode(rel) {
    if (rel.root) {
        return rootRelToNode(rel.root);
    } else {
        throw new Error(`Unrecognized plan relation ${JSON.stringify(rel)}`);
    }
}

function indentify(val) {
    return val.split(/\n/).map(x => '  ' + x).join('\n');
}

module.exports = {
    substraitToMermaid: function (plan) {
        mermaid = 'graph LR\n';
        for (let relation of plan.relations) {
            node = planRelationToNode(relation);
            value = nodeToMermaid(node);
            mermaid += indentify(value);
        }
        return mermaid;
    }
}
