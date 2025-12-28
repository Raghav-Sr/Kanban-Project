<script lang="ts">
	import { enhance } from '$app/forms';
	import { dndzone } from 'svelte-dnd-action';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showAddTask = $state(false);
	let selectedColumnId = $state('');
	let loading = $state(false);

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

	function handleDndConsider(columnId: string, e: CustomEvent<{ items: typeof data.tasks }>) {
		tasksByColumn[columnId] = e.detail.items;
	}

	async function handleDndFinalize(columnId: string, e: CustomEvent<{ items: typeof data.tasks }>) {
		tasksByColumn[columnId] = e.detail.items;

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
	}

	function openAddTask(columnId: string) {
		selectedColumnId = columnId;
		showAddTask = true;
	}

	function closeAddTask() {
		showAddTask = false;
		selectedColumnId = '';
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
							<span class="text-sm text-gray-500">{getTasksForColumn(column.id).length} tasks</span>
						</div>
						<button
							onclick={() => openAddTask(column.id)}
							class="rounded-full bg-sky-500 text-white w-7 h-7 flex items-center justify-center hover:bg-sky-600"
							aria-label="Add task"
						>
							+
						</button>
					</div>
				</div>

				<!-- Tasks -->
				<div
					class="flex flex-col gap-2 p-2 min-h-[200px] rounded-b-lg"
					use:dndzone={{
						items: getTasksForColumn(column.id),
						flipDurationMs: 200
					}}
					onconsider={(e) => handleDndConsider(column.id, e)}
					onfinalize={(e) => handleDndFinalize(column.id, e)}
				>
					{#each getTasksForColumn(column.id) as task (task.id)}
						<div class="rounded-lg bg-sky-100 p-3 cursor-grab hover:bg-sky-200 text-black active:cursor-grabbing">
							<p class="font-medium">{task.title}</p>
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
