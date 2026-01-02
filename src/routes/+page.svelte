<script lang="ts">
	import { enhance } from '$app/forms';
	import { dndzone } from 'svelte-dnd-action';
	import { DatePicker } from 'date-picker-svelte';
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
	let editDueDate = $state<Date | null>(null);
	let showEditDatePicker = $state(false);
	let showAddColumn = $state(false);
	let newColumnName = $state('');
	let newTaskDueDate = $state<Date | null>(null);
	let showAddTaskDatePicker = $state(false);

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
		newTaskDueDate = null;
		showAddTaskDatePicker = false;
	}

	function openTaskDetail(task: typeof data.tasks[0]) {
		selectedTask = task;
		editTitle = task.title;
		editDescription = (task as any).description ?? '';
		editAssigneeId = task.assignee_id ?? null;
		editDueDate = task.due_date ? new Date(task.due_date) : null;
		showTaskDetail = true;
	}

	function closeTaskDetail() {
		showTaskDetail = false;
		selectedTask = null;
		editTitle = '';
		editDescription = '';
		editAssigneeId = null;
		editDueDate = null;
		showEditDatePicker = false;
	}

	function formatDateForDB(date: Date | null): string | null {
		if (!date) return null;
		return date.toISOString().split('T')[0];
	}

	function openAddColumn() {
		showAddColumn = true;
		newColumnName = '';
	}

	function closeAddColumn() {
		showAddColumn = false;
		newColumnName = '';
	}

	async function createColumn() {
		if (!newColumnName.trim()) return;
		loading = true;

		const position = data.columns.length;

		const { error } = await data.supabase.from('columns').insert({
			name: newColumnName.trim(),
			household_id: data.member.household_id,
			position
		});

		if (error) {
			console.error('Create column error:', error);
			loading = false;
			return;
		}

		// Refresh the page to get updated columns
		loading = false;
		closeAddColumn();
		window.location.reload();
	}

	async function deleteTask() {
		if (!selectedTask) return;
		loading = true;

		const { error } = await data.supabase
			.from('tasks')
			.delete()
			.eq('id', selectedTask.id);

		if (error) {
			console.error('Delete error:', error);
			loading = false;
			return;
		}

		// Remove from local state
		const columnId = selectedTask.column_id;
		if (tasksByColumn[columnId]) {
			tasksByColumn[columnId] = tasksByColumn[columnId].filter(t => t.id !== selectedTask.id);
		}
		updateTaskCounts();

		loading = false;
		closeTaskDetail();
	}

	async function saveTaskDetail() {
		if (!selectedTask) return;
		loading = true;

		const dueDateString = formatDateForDB(editDueDate);

		const { error } = await data.supabase
			.from('tasks')
			.update({
				title: editTitle,
				description: editDescription,
				assignee_id: editAssigneeId,
				due_date: dueDateString
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
		selectedTask.due_date = dueDateString;

		// Update tasksByColumn to reflect the change
		for (const columnId in tasksByColumn) {
			const tasks = tasksByColumn[columnId];
			const taskIndex = tasks.findIndex(t => t.id === selectedTask.id);
			if (taskIndex !== -1) {
				tasks[taskIndex] = {
					...tasks[taskIndex],
					title: editTitle,
					assignee_id: editAssigneeId,
					assignee: newAssignee ? { id: newAssignee.id, name: newAssignee.name } : null,
					due_date: dueDateString
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
							class="rounded-full bg-sky-200 text-gray-600 w-7 h-7 flex items-center justify-center hover:bg-[#a8ddfb]"
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
						dropTargetStyle: {}
					}}
					onconsider={(e) => handleDndConsider(column.id, e)}
					onfinalize={(e) => handleDndFinalize(column.id, e)}
				>
					{#each getTasksForColumn(column.id) as task (task.id)}
						<div class="rounded-lg bg-sky-100 p-3 cursor-grab hover:bg-[#d0ecfd] text-black active:cursor-grabbing">
							<div class="flex items-start justify-between">
								<p class="font-medium">{task.title}</p>
								<button
									onclick={(e) => { e.stopPropagation(); openTaskDetail(task); }}
									class="text-gray-500 hover:text-gray-900 p-1.5 -mr-1 -mt-1 transition-colors"
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

		<!-- Add Column Button -->
		<div class="flex flex-shrink-0 items-start pt-3">
			<button
				onclick={openAddColumn}
				class="rounded-full bg-sky-200 text-gray-600 w-7 h-7 flex items-center justify-center hover:bg-[#a8ddfb]"
				aria-label="Add column"
			>
				+
			</button>
		</div>
	</div>
</div>

<!-- Add Task Modal -->
{#if showAddTask}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={closeAddTask}>
		<div class="bg-white rounded-lg w-full max-w-md p-6" onclick={(e) => e.stopPropagation()}>
			<h2 class="text-xl font-bold text-black mb-4">Add Task</h2>

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

				<label class="block mb-4">
					<span class="text-sm text-gray-500 mb-1 block">Title</span>
					<input type="text" name="title" class="w-full p-3 text-black bg-gray-50 border border-gray-200 rounded-lg focus:border-sky-500 focus:outline-none" placeholder="Task title" required />
				</label>

				<label class="block mb-4">
					<span class="text-sm text-gray-500 mb-1 block">Assignee</span>
					<select name="assigneeId" class="w-full p-3 text-black bg-gray-50 border border-gray-200 rounded-lg focus:border-sky-500 focus:outline-none">
						<option value="">Unassigned</option>
						{#each data.members as member}
							<option value={member.id}>{member.name}</option>
						{/each}
					</select>
				</label>

				<div class="block mb-4">
					<span class="text-sm text-gray-500 mb-1 block">Due Date</span>
					<input type="hidden" name="dueDate" value={newTaskDueDate ? formatDateForDB(newTaskDueDate) : ''} />
					<div class="flex gap-2 items-center mb-2">
						<input
							type="date"
							value={newTaskDueDate ? formatDateForDB(newTaskDueDate) : ''}
							onfocus={() => showAddTaskDatePicker = true}
							onchange={(e) => {
								const val = e.currentTarget.value;
								newTaskDueDate = val ? new Date(val + 'T00:00:00') : null;
							}}
							class="flex-1 p-3 text-black bg-gray-50 border border-gray-200 rounded-lg focus:border-sky-500 focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => newTaskDueDate = null}
							class="px-3 py-3 text-gray-500 hover:bg-gray-100 rounded-lg"
							title="Clear date"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
					{#if showAddTaskDatePicker}
						<div class="relative z-10">
							<DatePicker bind:value={newTaskDueDate} />
							<button
								type="button"
								onclick={() => showAddTaskDatePicker = false}
								class="mt-2 px-3 py-1 text-sm text-sky-600 hover:bg-sky-50 rounded"
							>
								Done
							</button>
						</div>
					{/if}
				</div>

				<div class="flex justify-end gap-2">
					<button type="button" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg" onclick={closeAddTask}>
						Cancel
					</button>
					<button type="submit" class="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50" disabled={loading}>
						{loading ? 'Adding...' : 'Add Task'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Add Column Modal -->
{#if showAddColumn}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={closeAddColumn}>
		<div class="bg-white rounded-lg w-full max-w-md p-6" onclick={(e) => e.stopPropagation()}>
			<h2 class="text-xl font-bold text-black mb-4">Add Column</h2>

			<label class="block mb-4">
				<span class="text-sm text-gray-500 mb-1 block">Column Name</span>
				<input
					type="text"
					bind:value={newColumnName}
					class="w-full p-3 text-black bg-gray-50 border border-gray-200 rounded-lg focus:border-sky-500 focus:outline-none"
					placeholder="e.g., In Review"
				/>
			</label>

			<div class="flex justify-end gap-2">
				<button class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg" onclick={closeAddColumn}>
					Cancel
				</button>
				<button
					class="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50"
					onclick={createColumn}
					disabled={loading || !newColumnName.trim()}
				>
					{loading ? 'Creating...' : 'Create Column'}
				</button>
			</div>
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

			<!-- Due Date -->
			<div class="block mb-4">
				<span class="text-sm text-gray-500 mb-1 block">Due Date</span>
				<div class="flex gap-2 items-center mb-2">
					<input
						type="date"
						value={editDueDate ? formatDateForDB(editDueDate) : ''}
						onfocus={() => showEditDatePicker = true}
						onchange={(e) => {
							const val = e.currentTarget.value;
							editDueDate = val ? new Date(val + 'T00:00:00') : null;
						}}
						class="flex-1 p-3 text-black bg-gray-50 border border-gray-200 rounded-lg focus:border-sky-500 focus:outline-none"
					/>
					<button
						type="button"
						onclick={() => editDueDate = null}
						class="px-3 py-3 text-gray-500 hover:bg-gray-100 rounded-lg"
						title="Clear date"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				{#if showEditDatePicker}
					<div class="relative z-10">
						<DatePicker bind:value={editDueDate} />
						<button
							type="button"
							onclick={() => showEditDatePicker = false}
							class="mt-2 px-3 py-1 text-sm text-sky-600 hover:bg-sky-50 rounded"
						>
							Done
						</button>
					</div>
				{/if}
			</div>

			<!-- Space for future features -->
			<div class="border-t border-gray-200 pt-4 mt-4">
				<p class="text-sm text-gray-400">More options coming soon...</p>
			</div>

			<!-- Actions -->
			<div class="flex justify-between mt-6">
				<button
					class="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
					onclick={deleteTask}
					disabled={loading}
				>
					Delete
				</button>
				<div class="flex gap-2">
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
	</div>
{/if}
