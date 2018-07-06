'use strict';

var _ = require('lodash');

/**
 * Recursively converts a swagger type description into a typescript type, i.e., a model for our mustache
 * template.
 *
 * Not all type are currently supported, but they should be straightforward to add.
 *
 * @param swaggerType a swagger type definition, i.e., the right hand side of a swagger type definition.
 * @returns a recursive structure representing the type, which can be used as a template model.
 */
function convertType(swaggerType, swagger) {
    var typespec = {
        description: swaggerType.description,
        isEnum: false,
        isNullable: !swaggerType.required,
        requiredPropertyNames: (swaggerType.type === "object" && swaggerType.required) || []
    };

    if (swaggerType.hasOwnProperty('schema')) {
        return convertType(swaggerType.schema);
    } else if (_.isString(swaggerType.$ref)) {
        typespec.tsType = 'ref';
        typespec.target = swaggerType.$ref.substring(swaggerType.$ref.lastIndexOf('/') + 1);
    } else if (swaggerType.hasOwnProperty('enum')) {
        typespec.tsType = swaggerType.enum.map(function(str) { return JSON.stringify(str); }).join(' | ');
        typespec.isAtomic = true;
        typespec.isEnum = true;
        typespec.enum = swaggerType.enum;
    } else if (swaggerType.type === 'string') {
        typespec.tsType = 'string';
    } else if (swaggerType.type === 'number' || swaggerType.type === 'integer') {
        typespec.tsType = 'number';
    } else if (swaggerType.type === 'boolean') {
        typespec.tsType = 'boolean';
    } else if (swaggerType.type === 'array') {
        typespec.elementType = convertType(swaggerType.items);
        typespec.tsType = `Array<${typespec.elementType.target || typespec.elementType.tsType || 'any'}>`;
    } else if (swaggerType.type === 'object' && swaggerType.hasOwnProperty("additionalProperties")) {
        // case where a it's a dictionary<string, someType>
        typespec.elementType = convertType(swaggerType.additionalProperties);
        typespec.tsType = `Dictionary<${typespec.elementType.target || typespec.elementType.tsType || 'any'}>`;
    } else /*if (swaggerType.type === 'object')*/ { //remaining types are created as objects
        if (swaggerType.minItems >= 0 && swaggerType.hasOwnProperty('title') && !swaggerType.$ref) {
            typespec.tsType = 'any';
        }
        else {
            typespec.tsType = 'object';
            typespec.properties = [];
            if (swaggerType.allOf) {
                _.forEach(swaggerType.allOf, function (ref) {
                    if (ref.$ref) {
                        let refSegments = ref.$ref.split('/');
                        let name = refSegments[refSegments.length - 1];
                        _.forEach(swagger.definitions, function (definition, definitionName) {
                            if (definitionName === name) {
                                var property = convertType(definition, swagger);
                                typespec.properties.push(...property.properties);
                            }
                        });
                    } else {
                        var property = convertType(ref);
                        typespec.properties.push(...property.properties);
                    }
                });
            }

            _.forEach(swaggerType.properties, function (propertyType, propertyName) {
                var property = convertType(propertyType);
                property.name = propertyName;
                property.isRequired = _.includes(typespec.requiredPropertyNames, propertyName);
                typespec.properties.push(property);
            });
        }
    }

    // Since Mustache does not provide equality checks, we need to do the case distinction via explicit booleans
    typespec.isRef = typespec.tsType === 'ref';
    typespec.isObject = typespec.tsType === 'object';
    typespec.isArray = typespec.tsType.indexOf('Array<') > -1;
    typespec.isDictionary = typespec.tsType.indexOf('Dictionary<') > -1;
    typespec.isAtomic = typespec.isAtomic || _.includes(['string', 'number', 'boolean', 'any'], typespec.tsType);

    return typespec;

}

module.exports.convertType = convertType;

