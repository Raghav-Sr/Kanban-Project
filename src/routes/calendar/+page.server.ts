import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		throw redirect(303, '/login');
	}

	// Get member and household
	const { data: members } = await locals.supabase
		.from('members')
		.select('id, name, household_id, households(id, name)')
		.eq('user_id', user.id)
		.limit(1);

	const member = members?.[0] ?? null;

	if (!member) {
		throw redirect(303, '/onboarding');
	}

	// Get all tasks for the household (we'll filter by month on the client)
	const { data: tasks } = await locals.supabase
		.from('tasks')
		.select('*, assignee:members(id, name)')
		.eq('household_id', member.household_id)
		.eq('archived', false)
		.order('due_date');

	const { data: householdMembers } = await locals.supabase
		.from('members')
		.select('id, name')
		.eq('household_id', member.household_id);

	return {
		member,
		household: member.households,
		tasks: tasks ?? [],
		members: householdMembers ?? []
	};
};
