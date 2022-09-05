import { CallExpression, Node, ObjectLiteralElementLike } from 'ts-morph'
import { getStringFromStringOrArrayLiteral } from './utils.js'

export const handleReactHookCall = (type: string, callExpression: CallExpression) => {
	if (type === 'useQuery') {
		const arguments_ = callExpression.getArguments()
		const pathAndInputArgument = arguments_[0]
		const configArgument = arguments_[1]

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

		if (Node.isArrayLiteralExpression(pathAndInputArgument)) {
			const elements = pathAndInputArgument.getElements()

			callExpression.insertArgument(0, elements[1].getText())
			const pathElement = elements[0]

			if (Node.isStringLiteral(pathElement)) {
				const path = pathElement.getLiteralText()
				callExpression.removeArgument(pathAndInputArgument)
				return path
			}
		}
	}

	if (type === 'useMutation') {
		const arguments_ = callExpression.getArguments()
		const pathArgument = arguments_[0]

		const path = getStringFromStringOrArrayLiteral(pathArgument)

		callExpression.removeArgument(pathArgument)
		return path
	}
}
