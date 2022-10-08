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

	const mutation = trpc.useMutation('post.create')
}
