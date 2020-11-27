import * as ts from "typescript";
import * as lua from "../../../LuaAST";
import { FunctionVisitor, TransformationContext } from "../../context";
import { AnnotationKind, getTypeAnnotations } from "../../utils/annotations";
import { annotationInvalidArgumentCount, extensionCannotConstruct } from "../../utils/diagnostics";
import { importLuaLibFeature, LuaLibFeature, transformLuaLibFunction } from "../../utils/lualib";
import { transformArguments } from "../call";
import { transformLuaTableNewExpression } from "../lua-table";

const builtinErrorTypeNames = new Set([
    "Error",
    "ErrorConstructor",
    "RangeError",
    "RangeErrorConstructor",
    "ReferenceError",
    "ReferenceErrorConstructor",
    "SyntaxError",
    "SyntaxErrorConstructor",
    "TypeError",
    "TypeErrorConstructor",
    "URIError",
    "URIErrorConstructor",
]);

// TODO: Do it in identifier?
export function checkForLuaLibType(context: TransformationContext, type: ts.Type): void {
    if (!type.symbol) return;

    const name = context.checker.getFullyQualifiedName(type.symbol);
    switch (name) {
        case "Map":
            importLuaLibFeature(context, LuaLibFeature.Map);
            return;
        case "Set":
            importLuaLibFeature(context, LuaLibFeature.Set);
            return;
        case "WeakMap":
            importLuaLibFeature(context, LuaLibFeature.WeakMap);
            return;
        case "WeakSet":
            importLuaLibFeature(context, LuaLibFeature.WeakSet);
            return;
    }

    if (builtinErrorTypeNames.has(name)) {
        importLuaLibFeature(context, LuaLibFeature.Error);
    }
}

export const transformNewExpression: FunctionVisitor<ts.NewExpression> = (node, context) => {
    const luaTableResult = transformLuaTableNewExpression(context, node);
    if (luaTableResult) {
        return luaTableResult;
    }

    const name = context.transformExpression(node.expression);
    const signature = context.checker.getResolvedSignature(node);
    const params = node.arguments
        ? transformArguments(context, node.arguments, signature)
        : [lua.createBooleanLiteral(true)];

    const type = context.checker.getTypeAtLocation(node);

    checkForLuaLibType(context, type);

    const annotations = getTypeAnnotations(type);

    if (annotations.has(AnnotationKind.Extension) || annotations.has(AnnotationKind.MetaExtension)) {
        context.diagnostics.push(extensionCannotConstruct(node));
    }

    const customConstructorAnnotation = annotations.get(AnnotationKind.CustomConstructor);
    if (customConstructorAnnotation) {
        if (customConstructorAnnotation.args.length === 1) {
            return lua.createCallExpression(
                lua.createIdentifier(customConstructorAnnotation.args[0]),
                transformArguments(context, node.arguments ?? []),
                node
            );
        } else {
            context.diagnostics.push(
                annotationInvalidArgumentCount(
                    node,
                    AnnotationKind.CustomConstructor,
                    customConstructorAnnotation.args.length,
                    1
                )
            );
        }
    }

    return transformLuaLibFunction(context, LuaLibFeature.New, node, name, ...params);
};
