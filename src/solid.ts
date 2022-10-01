import { CallExpression, Node, ObjectLiteralElementLike } from 'ts-morph'
import { getStringFromStringOrArrayLiteral } from './utils.js'

export const handleSolidHookCall = (
	type: string,
	callExpression: CallExpression,
) => {
	if (type === 'createQuery') {
		const arguments_ = callExpression.getArguments()
		const [pathArgument, configArgument] = arguments_
		if (Node.isArrowFunction(pathArgument)) {
			const body = pathArgument.getBody()
			if (Node.isArrayLiteralExpression(body)) {
				console.log('isarray=true')
				const elements = body.getElements()
				const [pathElement, argumentsElement] = elements
				callExpression.insertArgument(0, argumentsElement.getText())
				if (Node.isStringLiteral(pathElement)) {
					const path = pathElement.getLiteralText()
					callExpression.removeArgument(pathArgument)
					return path
				}
			}
		}
		if (Node.isObjectLiteralExpression(configArgument)) {
			const trpcPropertyNames = ['context', 'ssr']

			const trpcProperties = trpcPropertyNames
				.map((property) => configArgument.getProperty(property))
				.filter((node): node is ObjectLiteralElementLike => !!node)

			configArgument.addPropertyAssignment({
				name: 'trpc',
				initializer: `{${trpcProperties.map((v) => v.getText()).join(',')}}`,
			})

			for (const property of trpcProperties) {
				property.remove()
			}

			configArgument.formatText()
		}
	}

	if (type === 'createMutation') {
		const arguments_ = callExpression.getArguments()
		const pathArgument = arguments_[0]
		if (Node.isArrowFunction(pathArgument)) {
			const path = getStringFromStringOrArrayLiteral(pathArgument.getBody())
			callExpression.removeArgument(pathArgument)
			return path
		}
	}
}
