import { createTRPCReact } from '@trpc/react'
import { trpc } from '~/utils/trpc'

function Component() {
	const data = trpc.useQuery(['post.byId', { id: 1 }], {
		onSuccess() {
			console.log('success')
		},
		context: {
			foo: 'bar',
		},
	})

	trpc.useQuery(['post.get-title', { title: 'hello' }])

	trpc.useQuery(['hello'], {
		thing: true,
	})

	trpc.useQuery(['hello'], {
		thing: true,
		ssr: true,
	})

	const mutation = trpc.useMutation('post.create', {
		onSuccess() {
			console.log('success')
		},
	})

	const utils = trpc.useContext()

	utils.invalidateQueries(['post.byId'], { active: true })
	utils.cancelQuery(['post.byId'])
	utils.prefetchQuery([path])
	utils.prefetchQuery(['post.byId', { id: 1 }])
	utils.prefetchQuery(['post.get-title', { title: 'hello' }])
	utils.setQueryData(['post.byId', { id: 1 }], () => {})
}
