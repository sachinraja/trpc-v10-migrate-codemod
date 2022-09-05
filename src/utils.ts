import { CodeBlockWriter, Node, ObjectLiteralElementLike, SyntaxKind } from 'ts-morph'

export const getStringFromStringOrArrayLiteral = (node: Node) => {
	if (Node.isStringLiteral(node)) {
		return node.getLiteralValue()
	}
	if (Node.isArrayLiteralExpression(node)) {
		return node.getElements()[0]
			.asKindOrThrow(SyntaxKind.StringLiteral)
			.getLiteralText()
	}
}

export const writeValueFromObjectLiteralElement = (writer: CodeBlockWriter, node: ObjectLiteralElementLike) => {
	if (Node.isMethodDeclaration(node)) {
		const parameters = node.getParameters().map((parameter) => parameter.getText())
		return writer.write('(').write(parameters.join(', ')).write(') => ').inlineBlock(() => {
			writer.write(node.getBodyText() ?? '')
		})
	}
	if (Node.isPropertyAssignment(node)) {
		return writer.write(node.getChildAtIndex(2).getText())
	}
	if (Node.isShorthandPropertyAssignment(node)) {
		return writer.write(node.getName())
	}
}

export const getStringLiteralOrText = (node: Node) => {
	if (Node.isStringLiteral(node)) {
		return node.getLiteralValue()
	}
	return node.getText()
}

export const getStringHash = (string_: string) => {
	let hash = 0
	for (let index = 0, length = string_.length; index < length; index++) {
		// eslint-disable-next-line unicorn/prefer-code-point
		const chr = string_.charCodeAt(index)
		hash = (hash << 5) - hash + chr
		hash = Math.trunc(hash)
	}
	return hash >>> 0
}
