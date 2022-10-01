import { CallExpression, Node } from 'ts-morph'

export const handleCallerCall = (callExpression: CallExpression) => {
	const arguments_ = callExpression.getArguments()
	const pathArgument = arguments_[0]

	if (Node.isStringLiteral(pathArgument)) {
		const path = pathArgument.getLiteralText()
		callExpression.removeArgument(pathArgument)
		return path
	}
}
