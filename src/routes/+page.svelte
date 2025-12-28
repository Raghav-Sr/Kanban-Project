<script lang="ts">
	import { enhance } from '$app/forms';
	import { dndzone } from 'svelte-dnd-action';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showAddTask = $state(false);
	let selectedColumnId = $state('');
	let loading = $state(false);
	let hoveredColumnId = $state<string | null>(null);
	let showTaskDetail = $state(false);
	let selectedTask = $state<typeof data.tasks[0] | null>(null);
	let editTitle = $state('');
	let editDescription = $state('');
	let editAssigneeId = $state<string | null>(null);

	// Create reactive task lists per column
	let tasksByColumn = $state<Record<string, typeof data.tasks>>({});

	// Initialize tasks by column
	$effect(() => {
		const grouped: Record<string, typeof data.tasks> = {};
		for (const column of data.columns) {
			grouped[column.id] = data.tasks.filter((task) => task.column_id === column.id);
		}
		tasksByColumn = grouped;
	});

	function getTasksForColumn(columnId: string) {
		return tasksByColumn[columnId] ?? [];
	}

	// Track confirmed task counts (updates only after drop)
	let confirmedTaskCounts = $state<Record<string, number>>({});

	$effect(() => {
		const counts: Record<string, number> = {};
		for (const column of data.columns) {
			counts[column.id] = data.tasks.filter((task) => task.column_id === column.id).length;
		}
		confirmedTaskCounts = counts;
	});

	function getTaskCountForColumn(columnId: string) {
		return confirmedTaskCounts[columnId] ?? 0;
	}

	function updateTaskCounts() {
		const counts: Record<string, number> = {};
		for (const column of data.columns) {
			counts[column.id] = (tasksByColumn[column.id] ?? []).length;
		}
		confirmedTaskCounts = counts;
	}

	function handleDndConsider(columnId: string, e: CustomEvent<{ items: typeof data.tasks }>) {
		tasksByColumn[columnId] = e.detail.items;
		hoveredColumnId = columnId;
	}

	async function handleDndFinalize(columnId: string, e: CustomEvent<{ items: typeof data.tasks }>) {
		tasksByColumn[columnId] = e.detail.items;
		hoveredColumnId = null;

		// Update tasks that moved to this column
		for (let i = 0; i < e.detail.items.length; i++) {
			const task = e.detail.items[i];
			if (task.column_id !== columnId || task.position !== i) {
				// Update in database
				await data.supabase
					.from('tasks')
					.update({ column_id: columnId, position: i })
					.eq('id', task.id);

				// Update local state
				task.column_id = columnId;
				task.position = i;
			}
		}

		// Update counters after drop
		updateTaskCounts();
	}

	function openAddTask(columnId: string) {
		selectedColumnId = columnId;
		showAddTask = true;
	}

	function closeAddTask() {
		showAddTask = false;
		selectedColumnId = '';
	}

	function openTaskDetail(task: typeof data.tasks[0]) {
		selectedTask = task;
		editTitle = task.title;
		editDescription = (task as any).description ?? '';
		editAssigneeId = task.assignee_id ?? null;
		showTaskDetail = true;
	}

	function closeTaskDetail() {
		showTaskDetail = false;
		selectedTask = null;
		editTitle = '';
		editDescription = '';
		editAssigneeId = null;
	}

	async function saveTaskDetail() {
		if (!selectedTask) return;
		loading = true;

		const { error } = await data.supabase
			.from('tasks')
			.update({
				title: editTitle,
				description: editDescription,
				assignee_id: editAssigneeId
			})
			.eq('id', selectedTask.id);

		if (error) {
			console.error('Save error:', error);
			loading = false;
			return;
		}

		// Find the new assignee name
		const newAssignee = data.members.find(m => m.id === editAssigneeId);

		// Update local state
		selectedTask.title = editTitle;
		(selectedTask as any).description = editDescription;
		selectedTask.assignee_id = editAssigneeId;
		selectedTask.assignee = newAssignee ? { id: newAssignee.id, name: newAssignee.name } : null;

		// Update tasksByColumn to reflect the change
		for (const columnId in tasksByColumn) {
			const tasks = tasksByColumn[columnId];
			const taskIndex = tasks.findIndex(t => t.id === selectedTask.id);
			if (taskIndex !== -1) {
				tasks[taskIndex] = {
					...tasks[taskIndex],
					title: editTitle,
					assignee_id: editAssigneeId,
					assignee: newAssignee ? { id: newAssignee.id, name: newAssignee.name } : null
				};
			}
		}

		loading = false;
		closeTaskDetail();
	}
</script>

<div class="min-h-screen bg-white p-6 text-black">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="h2 text-black">{data.household?.name ?? 'My Household'}</h1>
	</div>

	<!-- Kanban Board -->
	<div class="flex gap-4 overflow-x-auto pb-4">
		{#each data.columns as column}
			<div class="flex w-80 flex-shrink-0 flex-col rounded-lg bg-gray-100">
				<!-- Column Header -->
				<div class="border-b border-gray-200 p-3">
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-semibold text-black">{column.name}</h3>
							<span class="text-sm text-gray-500">{getTaskCountForColumn(column.id)} tasks</span>
						</div>
						<button
							onclick={() => openAddTask(column.id)}
							class="rounded-full bg-sky-200 text-gray-600 w-7 h-7 flex items-center justify-center hover:bg-sky-300"
							aria-label="Add task"
						>
							+
						</button>
					</div>
				</div>

				<!-- Tasks -->
				<div
					class="flex flex-col gap-2 p-2 min-h-[200px] rounded-b-lg transition-colors duration-150"
					class:bg-gray-200={hoveredColumnId === column.id}
					use:dndzone={{
						items: getTasksForColumn(column.id),
						flipDurationMs: 0,
						dropTargetStyle: { outline: 'none' }
					}}
					onconsider={(e) => handleDndConsider(column.id, e)}
					onfinalize={(e) => handleDndFinalize(column.id, e)}
				>
					{#each getTasksForColumn(column.id) as task (task.id)}
						<div class="rounded-lg bg-sky-100 p-3 cursor-grab hover:bg-sky-200 text-black active:cursor-grabbing">
							<div class="flex items-start justify-between">
								<p class="font-medium">{task.title}</p>
								<button
									onclick={(e) => { e.stopPropagation(); openTaskDetail(task); }}
									class="text-gray-500 hover:text-gray-700 hover:bg-sky-300 p-1.5 -mr-1 -mt-1 rounded-full transition-colors"
									aria-label="Task options"
								>
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
									</svg>
								</button>
							</div>
							<div class="mt-2 flex items-center justify-between text-sm text-gray-600">
								{#if task.assignee}
									<span>{task.assignee.name}</span>
								{:else}
									<span>Unassigned</span>
								{/if}
								{#if task.due_date}
									<span>{new Date(task.due_date).toLocaleDateString()}</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- Add Task Modal -->
{#if showAddTask}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={closeAddTask}>
		<div class="card w-full max-w-md p-6" onclick={(e) => e.stopPropagation()}>
			<h2 class="h3 mb-4">Add Task</h2>

			<form
				method="POST"
				action="?/createTask"
				use:enhance={() => {
					loading = true;
					return async ({ result, update }) => {
						loading = false;
						if (result.type === 'success') {
							closeAddTask();
							await update();
						}
					};
				}}
				class="space-y-4"
			>
				<input type="hidden" name="columnId" value={selectedColumnId} />
				<input type="hidden" name="householdId" value={data.member.household_id} />

				<label class="label">
					<span>Title</span>
					<input type="text" name="title" class="input" placeholder="Task title" required />
				</label>

				<label class="label">
					<span>Assignee</span>
					<select name="assigneeId" class="select">
						<option value="">Unassigned</option>
						{#each data.members as member}
							<option value={member.id}>{member.name}</option>
						{/each}
					</select>
				</label>

				<label class="label">
					<span>Due Date</span>
					<input type="date" name="dueDate" class="input" />
				</label>

				<div class="flex justify-end gap-2">
					<button type="button" class="btn preset-tonal-surface" onclick={closeAddTask}>
						Cancel
					</button>
					<button type="submit" class="btn preset-filled-primary-500" disabled={loading}>
						{loading ? 'Adding...' : 'Add Task'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Task Detail Modal -->
{#if showTaskDetail && selectedTask}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={closeTaskDetail}>
		<div class="bg-white rounded-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
			<!-- Title -->
			<input
				type="text"
				bind:value={editTitle}
				class="w-full text-2xl font-bold text-black bg-transparent border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-sky-500 focus:outline-none pb-2 mb-4"
				placeholder="Task title"
			/>

			<!-- Description -->
			<label class="block mb-4">
				<span class="text-sm text-gray-500 mb-1 block">Description</span>
				<textarea
					bind:value={editDescription}
					class="w-full h-40 p-3 text-black bg-gray-50 border border-gray-200 rounded-lg focus:border-sky-500 focus:outline-none resize-none"
					placeholder="Add a description..."
				></textarea>
			</label>

			<!-- Assignee -->
			<label class="block mb-4">
				<span class="text-sm text-gray-500 mb-1 block">Assignee</span>
				<select
					bind:value={editAssigneeId}
					class="w-full p-3 text-black bg-gray-50 border border-gray-200 rounded-lg focus:border-sky-500 focus:outline-none"
				>
					<option value={null}>Unassigned</option>
					{#each data.members as member}
						<option value={member.id}>{member.name}</option>
					{/each}
				</select>
			</label>

			<!-- Space for future features -->
			<div class="border-t border-gray-200 pt-4 mt-4">
				<p class="text-sm text-gray-400">More options coming soon...</p>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-2 mt-6">
				<button class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg" onclick={closeTaskDetail}>
					Cancel
				</button>
				<button
					class="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50"
					onclick={saveTaskDetail}
					disabled={loading}
				>
					{loading ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}
