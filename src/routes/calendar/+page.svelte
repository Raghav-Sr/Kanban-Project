<script lang="ts">
	import { DatePicker } from 'date-picker-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Current displayed month
	let currentDate = $state(new Date());

	// Task detail modal state
	let loading = $state(false);
	let showTaskDetail = $state(false);
	let selectedTask = $state<typeof data.tasks[0] | null>(null);
	let editTitle = $state('');
	let editDescription = $state('');
	let editAssigneeId = $state<string | null>(null);
	let editDueDate = $state<Date | null>(null);
	let showEditDatePicker = $state(false);

	// Get the year and month
	function getYear() {
		return currentDate.getFullYear();
	}

	function getMonth() {
		return currentDate.getMonth();
	}

	// Navigate months
	function previousMonth() {
		const newDate = new Date(currentDate);
		newDate.setMonth(newDate.getMonth() - 1);
		currentDate = newDate;
	}

	function nextMonth() {
		const newDate = new Date(currentDate);
		newDate.setMonth(newDate.getMonth() + 1);
		currentDate = newDate;
	}

	function goToToday() {
		currentDate = new Date();
	}

	// Format month display
	function formatMonthYear(date: Date): string {
		return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}

	// Get days in month
	function getDaysInMonth(year: number, month: number): number {
		return new Date(year, month + 1, 0).getDate();
	}

	// Get the day of week the month starts on (0 = Sunday)
	function getFirstDayOfMonth(year: number, month: number): number {
		return new Date(year, month, 1).getDay();
	}

	// Generate calendar grid
	function getCalendarDays() {
		const year = getYear();
		const month = getMonth();
		const daysInMonth = getDaysInMonth(year, month);
		const firstDay = getFirstDayOfMonth(year, month);

		const days: (number | null)[] = [];

		// Add empty cells for days before the first day of the month
		for (let i = 0; i < firstDay; i++) {
			days.push(null);
		}

		// Add the days of the month
		for (let day = 1; day <= daysInMonth; day++) {
			days.push(day);
		}

		return days;
	}

	// Format date string for comparison
	function formatDateString(year: number, month: number, day: number): string {
		const m = String(month + 1).padStart(2, '0');
		const d = String(day).padStart(2, '0');
		return `${year}-${m}-${d}`;
	}

	// Get tasks for a specific day with their type (due date or week start)
	function getTasksForDay(day: number) {
		const dateString = formatDateString(getYear(), getMonth(), day);
		const tasksWithType: { task: typeof data.tasks[0]; type: 'due' | 'assigned' }[] = [];

		data.tasks.forEach((task) => {
			const dueDate = task.due_date;
			const weekStart = (task as any).week_start;

			if (dueDate === dateString) {
				tasksWithType.push({ task, type: 'due' });
			} else if (weekStart === dateString) {
				tasksWithType.push({ task, type: 'assigned' });
			}
		});

		return tasksWithType;
	}

	// Check if a day is today
	function isToday(day: number): boolean {
		const today = new Date();
		return (
			day === today.getDate() &&
			getMonth() === today.getMonth() &&
			getYear() === today.getFullYear()
		);
	}

	// Get task color based on type (due date vs assigned/week start)
	function getTaskColor(type: 'due' | 'assigned'): string {
		if (type === 'due') {
			return 'bg-rose-100 text-rose-800';
		}
		return 'bg-sky-100 text-sky-800';
	}

	const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	// Task detail modal functions
	function formatDateForDB(date: Date | null): string | null {
		if (!date) return null;
		return date.toISOString().split('T')[0];
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

		loading = false;
		closeTaskDetail();
		window.location.reload();
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

		loading = false;
		closeTaskDetail();
		window.location.reload();
	}
</script>

<div class="min-h-screen bg-white p-6 text-black">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div class="flex items-center gap-4">
			<h1 class="text-2xl font-bold text-black">{data.household?.name ?? 'My Household'}</h1>
			<a href="/" class="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
				Board View
			</a>
		</div>

		<!-- Month Navigation -->
		<div class="flex items-center gap-3">
			<button
				onclick={previousMonth}
				class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
				aria-label="Previous month"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</button>

			<button
				onclick={goToToday}
				class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-w-[180px]"
			>
				{formatMonthYear(currentDate)}
			</button>

			<button
				onclick={nextMonth}
				class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
				aria-label="Next month"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Calendar Grid -->
	<div class="border border-gray-200 rounded-lg overflow-hidden">
		<!-- Week day headers -->
		<div class="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
			{#each weekDays as day}
				<div class="p-3 text-center text-sm font-medium text-gray-600">
					{day}
				</div>
			{/each}
		</div>

		<!-- Calendar days -->
		<div class="grid grid-cols-7">
			{#each getCalendarDays() as day, index}
				<div
					class="min-h-[120px] border-b border-r border-gray-200 p-2 {day === null ? 'bg-gray-50' : 'bg-white'}"
					class:border-r-0={(index + 1) % 7 === 0}
				>
					{#if day !== null}
						<div class="flex items-center justify-between mb-1">
							<span
								class="text-sm font-medium {isToday(day) ? 'bg-sky-500 text-white w-7 h-7 rounded-full flex items-center justify-center' : 'text-gray-700'}"
							>
								{day}
							</span>
						</div>

						<!-- Tasks for this day -->
						<div class="space-y-1">
							{#each getTasksForDay(day).slice(0, 3) as { task, type }}
								<button
									onclick={() => openTaskDetail(task)}
									class="w-full text-left text-xs p-1 rounded truncate {getTaskColor(type)} hover:opacity-80 cursor-pointer"
									title="{task.title} ({type === 'due' ? 'Due' : 'Assigned'})"
								>
									{task.title}
								</button>
							{/each}
							{#if getTasksForDay(day).length > 3}
								<div class="text-xs text-gray-500">
									+{getTasksForDay(day).length - 3} more
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Legend -->
	<div class="mt-4 flex items-center gap-6 text-sm text-gray-600">
		<div class="flex items-center gap-2">
			<div class="w-3 h-3 rounded bg-sky-100 border border-sky-200"></div>
			<span>Week assigned</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-3 h-3 rounded bg-rose-100 border border-rose-200"></div>
			<span>Due date</span>
		</div>
	</div>
</div>

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
