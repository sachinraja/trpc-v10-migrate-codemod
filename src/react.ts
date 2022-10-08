import { CallExpression, Node, ObjectLiteralElementLike } from 'ts-morph'
import { normalizeProcedurePath } from './utils.js'

export const contextHelpers = [
	'invalidateQueries',
	'cancelQuery',
	'fetchQuery',
	'fetchInfiniteQuery',
	'getQueryData',
	'getInfiniteQueryData',
	'prefetchQuery',
	'prefetchInfiniteQuery',
	'refetchQueries',
	'setQueryData',
	'setInfiniteQueryData',
] as const

export type OldContextHelper = typeof contextHelpers[number]
export const contextHelpersToRename: Record<OldContextHelper, string> = {
	invalidateQueries: 'invalidate',
	cancelQuery: 'cancel',
	fetchQuery: 'fetch',
	fetchInfiniteQuery: 'fetchInfinite',
	getQueryData: 'getData',
	getInfiniteQueryData: 'getInfiniteData',
	prefetchQuery: 'prefetch',
	prefetchInfiniteQuery: 'prefetchInfinite',
	refetchQueries: 'refetch',
	setQueryData: 'setData',
	setInfiniteQueryData: 'setInfiniteData',
}

export const handleContextHelperCall = (callExpression: CallExpression) => {
	const arguments_ = callExpression.getArguments()
	const [pathArgument] = arguments_

	let rawPath: string | undefined
	let requiresUndefinedInput = true
	if (Node.isStringLiteral(pathArgument)) {
		rawPath = pathArgument.getLiteralValue()
		callExpression.removeArgument(pathArgument)
		if (arguments_.length === 1) requiresUndefinedInput = false
	} else if (Node.isArrayLiteralExpression(pathArgument)) {
		const elements = pathArgument.getElements()

		const pathElement = elements[0]
		if (!Node.isStringLiteral(pathElement)) return { requiresUndefinedInput: false }
		rawPath = pathElement.getLiteralText()
		callExpression.insertArguments(0, elements.slice(1).map(it => it.getText()))

		if (elements.length > 1 || arguments_.length === 1) {
			requiresUndefinedInput = false
		}
		callExpression.removeArgument(pathArgument)
	}

	const path = rawPath ? normalizeProcedurePath(rawPath) : undefined
	return { path, requiresUndefinedInput }
}

export const handleReactHookCall = (type: string, callExpression: CallExpression) => {
	if (type === 'useQuery') {
		const arguments_ = callExpression.getArguments()
		const [, configArgument] = arguments_

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

		const { path, requiresUndefinedInput } = handleContextHelperCall(callExpression)
		if (requiresUndefinedInput) {
			callExpression.insertArgument(0, 'undefined')
		}
		return path
	}

	if (type === 'useMutation') {
		// no input, so no need to handle undefined input
		const { path } = handleContextHelperCall(callExpression)
		return path
	}
}
