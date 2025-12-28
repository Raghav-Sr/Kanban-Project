<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleLogin(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';

		const { error: authError } = await data.supabase.auth.signInWithPassword({
			email,
			password
		});

		if (authError) {
			error = authError.message;
			loading = false;
		} else {
			window.location.href = '/';
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center p-4">
	<div class="card w-full max-w-md p-8">
		<h1 class="h2 mb-6 text-center">Log In</h1>

		{#if error}
			<aside class="alert variant-filled-error mb-4">
				<p>{error}</p>
			</aside>
		{/if}

		<form onsubmit={handleLogin} class="space-y-4">
			<label class="label">
				<span>Email</span>
				<input
					type="email"
					bind:value={email}
					class="input"
					placeholder="you@example.com"
					required
				/>
			</label>

			<label class="label">
				<span>Password</span>
				<input
					type="password"
					bind:value={password}
					class="input"
					placeholder="••••••••"
					required
				/>
			</label>

			<button type="submit" class="btn preset-filled-primary-500 w-full" disabled={loading}>
				{loading ? 'Logging in...' : 'Log In'}
			</button>
		</form>

		<p class="mt-4 text-center">
			Don't have an account? <a href="/signup" class="anchor">Sign up</a>
		</p>
	</div>
</div>
