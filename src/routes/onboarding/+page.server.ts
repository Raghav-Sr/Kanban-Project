import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		throw redirect(303, '/login');
	}

	// Check if user already has a household
	const { data: members } = await locals.supabase
		.from('members')
		.select('household_id')
		.eq('user_id', user.id)
		.limit(1);

	if (members && members.length > 0) {
		throw redirect(303, '/');
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();

		if (!user) {
			return fail(401, { message: 'Not authenticated' });
		}

		const formData = await request.formData();
		const householdName = formData.get('householdName') as string;
		const memberName = formData.get('memberName') as string;

		if (!householdName || !memberName) {
			return fail(400, { message: 'Please fill in all fields' });
		}

		// Create household with member and default columns
		console.log('Creating household:', householdName, 'for user:', user.id);

		const { data, error } = await locals.supabase.rpc('create_household_with_member', {
			household_name: householdName,
			member_name: memberName
		});

		console.log('RPC result:', { data, error });

		if (error) {
			console.error('Onboarding error:', error);
			return fail(500, { message: `Failed to create household: ${error.message}` });
		}

		console.log('Household created, redirecting...');
		throw redirect(303, '/');
	}
};
