import * as ts from "typescript";
import { TransformationContext } from "../../context";
import { AnnotationKind, getTypeAnnotations } from "../../utils/annotations";

export function isStaticNode(node: ts.Node): boolean {
    return (node.modifiers ?? []).some(m => m.kind === ts.SyntaxKind.StaticKeyword);
}

export function getExtendsClause(node: ts.ClassLikeDeclarationBase): ts.HeritageClause | undefined {
    return (node.heritageClauses ?? []).find(clause => clause.token === ts.SyntaxKind.ExtendsKeyword);
}

export function getExtendedNode(
    context: TransformationContext,
    node: ts.ClassLikeDeclarationBase
): ts.ExpressionWithTypeArguments | undefined {
    const extendsClause = getExtendsClause(node);
    if (!extendsClause) return;

    const superType = context.checker.getTypeAtLocation(extendsClause.types[0]);
    const annotations = getTypeAnnotations(superType);
    if (!annotations.has(AnnotationKind.PureAbstract)) {
        return extendsClause.types[0];
    }
}

export function getExtendedType(
    context: TransformationContext,
    node: ts.ClassLikeDeclarationBase
): ts.Type | undefined {
    const extendedNode = getExtendedNode(context, node);
    return extendedNode && context.checker.getTypeAtLocation(extendedNode);
}
