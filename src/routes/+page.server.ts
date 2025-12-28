import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		throw redirect(303, '/login');
	}

	// Check if user has a household
	console.log('Checking member for user:', user.id);

	const { data: members, error: memberError } = await locals.supabase
		.from('members')
		.select('id, name, household_id, households(id, name)')
		.eq('user_id', user.id)
		.limit(1);

	const member = members?.[0] ?? null;

	console.log('Member result:', { member, error: memberError });

	if (!member) {
		console.log('No member found, redirecting to onboarding');
		throw redirect(303, '/onboarding');
	}

	// Get columns and tasks for the household
	const { data: columns } = await locals.supabase
		.from('columns')
		.select('*')
		.eq('household_id', member.household_id)
		.order('position');

	const { data: tasks } = await locals.supabase
		.from('tasks')
		.select('*, assignee:members(id, name)')
		.eq('household_id', member.household_id)
		.eq('archived', false)
		.order('position');

	const { data: householdMembers } = await locals.supabase
		.from('members')
		.select('id, name')
		.eq('household_id', member.household_id);

	return {
		member,
		household: member.households,
		columns: columns ?? [],
		tasks: tasks ?? [],
		members: householdMembers ?? []
	};
};

export const actions: Actions = {
	createTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { message: 'Not authenticated' });

		const formData = await request.formData();
		const title = formData.get('title') as string;
		const columnId = formData.get('columnId') as string;
		const assigneeId = formData.get('assigneeId') as string | null;
		const dueDate = formData.get('dueDate') as string | null;
		const householdId = formData.get('householdId') as string;

		if (!title || !columnId || !householdId) {
			return fail(400, { message: 'Missing required fields' });
		}

		// Get the highest position in the column
		const { data: lastTask } = await locals.supabase
			.from('tasks')
			.select('position')
			.eq('column_id', columnId)
			.order('position', { ascending: false })
			.limit(1);

		const position = lastTask?.[0]?.position ?? 0 + 1;

		const { error } = await locals.supabase.from('tasks').insert({
			title,
			column_id: columnId,
			household_id: householdId,
			assignee_id: assigneeId || null,
			due_date: dueDate || null,
			position
		});

		if (error) {
			console.error('Create task error:', error);
			return fail(500, { message: 'Failed to create task' });
		}

		return { success: true };
	}
};
