<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { data, children } = $props();

	onMount(() => {
		const {
			data: { subscription }
		} = data.supabase.auth.onAuthStateChange((_, session) => {
			invalidate('supabase:auth');
		});

		return () => subscription.unsubscribe();
	});

	async function handleLogout() {
		await data.supabase.auth.signOut();
		window.location.href = '/login';
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div data-theme="cerberus" class="min-h-screen bg-surface-50-900-token">
	{#if data.user}
		<header class="bg-surface-100-800-token border-b border-surface-300-600-token">
			<nav class="mx-auto flex max-w-7xl items-center justify-between p-4">
				<a href="/" class="text-xl font-bold">Kanban</a>
				<div class="flex items-center gap-4">
					<span class="text-sm opacity-75">{data.user.email}</span>
					<button onclick={handleLogout} class="btn preset-tonal-surface btn-sm">
						Log out
					</button>
				</div>
			</nav>
		</header>
	{/if}

	<main>
		{@render children()}
	</main>
</div>
