<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let loading = $state(false);
</script>

<div class="flex min-h-screen items-center justify-center p-4">
	<div class="card w-full max-w-md p-8">
		<h1 class="h2 mb-2 text-center">Create Your Household</h1>
		<p class="mb-6 text-center opacity-75">Set up your household to start managing tasks together.</p>

		{#if form?.message}
			<aside class="alert variant-filled-error mb-4">
				<p>{form.message}</p>
			</aside>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ result }) => {
					loading = false;
					if (result.type === 'redirect') {
						window.location.href = result.location;
					}
				};
			}}
			class="space-y-4"
		>
			<label class="label">
				<span>Household Name</span>
				<input
					type="text"
					name="householdName"
					class="input"
					placeholder="e.g., The Smith Family"
					required
				/>
			</label>

			<label class="label">
				<span>Your Display Name</span>
				<input
					type="text"
					name="memberName"
					class="input"
					placeholder="e.g., John"
					required
				/>
			</label>

			<button type="submit" class="btn preset-filled-primary-500 w-full" disabled={loading}>
				{loading ? 'Creating...' : 'Create Household'}
			</button>
		</form>
	</div>
</div>
