<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let error = $state('');
	let success = $state(false);

	async function handleSignup(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			loading = false;
			return;
		}

		if (password.length < 6) {
			error = 'Password must be at least 6 characters';
			loading = false;
			return;
		}

		const { error: authError } = await data.supabase.auth.signUp({
			email,
			password
		});

		if (authError) {
			error = authError.message;
			loading = false;
		} else {
			success = true;
			loading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center p-4">
	<div class="card w-full max-w-md p-8">
		<h1 class="h2 mb-6 text-center">Sign Up</h1>

		{#if success}
			<aside class="alert variant-filled-success mb-4">
				<p>Check your email for a confirmation link!</p>
			</aside>
		{:else}
			{#if error}
				<aside class="alert variant-filled-error mb-4">
					<p>{error}</p>
				</aside>
			{/if}

			<form onsubmit={handleSignup} class="space-y-4">
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

				<label class="label">
					<span>Confirm Password</span>
					<input
						type="password"
						bind:value={confirmPassword}
						class="input"
						placeholder="••••••••"
						required
					/>
				</label>

				<button type="submit" class="btn preset-filled-primary-500 w-full" disabled={loading}>
					{loading ? 'Creating account...' : 'Sign Up'}
				</button>
			</form>
		{/if}

		<p class="mt-4 text-center">
			Already have an account? <a href="/login" class="anchor">Log in</a>
		</p>
	</div>
</div>
