<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
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

	// Day modal state
	let showDayModal = $state(false);
	let selectedDay = $state<Date | null>(null);
	let dayModalTasksByColumn = $state<Record<string, typeof data.tasks>>({});
	let hoveredColumnId = $state<string | null>(null);

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

	// Get bar color based on column status
	function getBarColorByColumn(task: typeof data.tasks[0]): { bg: string; text: string } {
		const column = data.columns.find((c) => c.id === task.column_id);
		const columnName = column?.name?.toLowerCase() ?? '';

		if (columnName.includes('not started') || columnName === 'not started') {
			return { bg: 'bg-rose-300', text: 'text-rose-900' };
		} else if (columnName.includes('in progress') || columnName === 'in progress') {
			return { bg: 'bg-sky-300', text: 'text-sky-900' };
		} else if (columnName.includes('completed') || columnName.includes('done') || columnName === 'completed') {
			return { bg: 'bg-emerald-300', text: 'text-emerald-900' };
		} else {
			return { bg: 'bg-gray-300', text: 'text-gray-700' };
		}
	}

	// Get tasks that have both week_start and due_date for bar visualization
	function getTasksWithDateRange() {
		return data.tasks.filter((task) => {
			const weekStart = (task as any).week_start;
			const dueDate = task.due_date;
			return weekStart && dueDate && weekStart !== dueDate;
		});
	}

	// Calculate the grid position for a date within the current month view
	function getGridPositionForDate(dateStr: string): { row: number; col: number } | null {
		const date = new Date(dateStr + 'T00:00:00');
		const year = getYear();
		const month = getMonth();

		// Check if date is in current month
		if (date.getFullYear() !== year || date.getMonth() !== month) {
			// Return edge positions for dates outside month
			if (date < new Date(year, month, 1)) {
				return { row: 0, col: 0 }; // Before month starts
			} else {
				const daysInMonth = getDaysInMonth(year, month);
				const lastDayPos = getFirstDayOfMonth(year, month) + daysInMonth - 1;
				return { row: Math.floor(lastDayPos / 7), col: lastDayPos % 7 };
			}
		}

		const day = date.getDate();
		const firstDay = getFirstDayOfMonth(year, month);
		const position = firstDay + day - 1;
		return { row: Math.floor(position / 7), col: position % 7 };
	}

	// Calculate bar segment info for a task across rows
	interface BarSegment {
		task: typeof data.tasks[0];
		row: number;
		startCol: number;
		endCol: number;
		isStart: boolean;
		isEnd: boolean;
	}

	function getTaskBarSegments(): BarSegment[] {
		const tasksWithRange = getTasksWithDateRange();
		const segments: BarSegment[] = [];
		const year = getYear();
		const month = getMonth();
		const firstDayOfMonth = new Date(year, month, 1);
		const lastDayOfMonth = new Date(year, month + 1, 0);

		tasksWithRange.forEach((task) => {
			const weekStart = (task as any).week_start as string;
			const dueDate = task.due_date as string;

			const startDate = new Date(weekStart + 'T00:00:00');
			const endDate = new Date(dueDate + 'T00:00:00');

			// Clamp dates to current month view
			const clampedStart = startDate < firstDayOfMonth ? firstDayOfMonth : startDate;
			const clampedEnd = endDate > lastDayOfMonth ? lastDayOfMonth : endDate;

			// Skip if entirely outside this month
			if (clampedStart > lastDayOfMonth || clampedEnd < firstDayOfMonth) {
				return;
			}

			const startPos = getGridPositionForDate(clampedStart.toISOString().split('T')[0]);
			const endPos = getGridPositionForDate(clampedEnd.toISOString().split('T')[0]);

			if (!startPos || !endPos) return;

			// Create segments for each row the task spans
			for (let row = startPos.row; row <= endPos.row; row++) {
				const segmentStartCol = row === startPos.row ? startPos.col : 0;
				const segmentEndCol = row === endPos.row ? endPos.col : 6;

				segments.push({
					task,
					row,
					startCol: segmentStartCol,
					endCol: segmentEndCol,
					isStart: row === startPos.row && clampedStart.getTime() === startDate.getTime(),
					isEnd: row === endPos.row && clampedEnd.getTime() === endDate.getTime()
				});
			}
		});

		return segments;
	}

	// Group segments by row and assign vertical positions to avoid overlap
	function getSegmentsByRow(): Map<number, (BarSegment & { lane: number })[]> {
		const segments = getTaskBarSegments();
		const rowMap = new Map<number, (BarSegment & { lane: number })[]>();

		// Group by row
		segments.forEach((segment) => {
			if (!rowMap.has(segment.row)) {
				rowMap.set(segment.row, []);
			}
			rowMap.get(segment.row)!.push({ ...segment, lane: 0 });
		});

		// Assign lanes within each row to avoid overlap
		rowMap.forEach((rowSegments) => {
			// Sort by start column
			rowSegments.sort((a, b) => a.startCol - b.startCol);

			// Track which lanes are occupied until which column
			const laneEndCols: number[] = [];

			rowSegments.forEach((segment) => {
				// Find first available lane
				let lane = 0;
				while (lane < laneEndCols.length && laneEndCols[lane] >= segment.startCol) {
					lane++;
				}
				segment.lane = lane;
				laneEndCols[lane] = segment.endCol;
			});
		});

		return rowMap;
	}

	// Get the number of calendar rows
	function getCalendarRowCount(): number {
		const days = getCalendarDays();
		return Math.ceil(days.length / 7);
	}

	const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	// Day modal functions
	function openDayModal(day: number) {
		selectedDay = new Date(getYear(), getMonth(), day);
		initializeDayModalTasks();
		showDayModal = true;
	}

	function closeDayModal() {
		showDayModal = false;
		selectedDay = null;
		dayModalTasksByColumn = {};
		hoveredColumnId = null;
	}

	function getSelectedDayString(): string {
		if (!selectedDay) return '';
		return selectedDay.toISOString().split('T')[0];
	}

	function formatSelectedDay(): string {
		if (!selectedDay) return '';
		return selectedDay.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function initializeDayModalTasks() {
		if (!selectedDay) return;
		const dateString = selectedDay.toISOString().split('T')[0];
		const grouped: Record<string, typeof data.tasks> = {};
		for (const column of data.columns) {
			grouped[column.id] = data.tasks.filter((task) => {
				const matchesColumn = task.column_id === column.id;
				const dueDate = task.due_date;
				const weekStart = (task as any).week_start;
				return matchesColumn && (dueDate === dateString || weekStart === dateString);
			});
		}
		dayModalTasksByColumn = grouped;
	}

	function getTasksForDayByColumn(columnId: string) {
		return dayModalTasksByColumn[columnId] ?? [];
	}

	function handleDayModalDndConsider(columnId: string, e: CustomEvent<{ items: typeof data.tasks }>) {
		dayModalTasksByColumn[columnId] = e.detail.items;
		hoveredColumnId = columnId;
	}

	async function handleDayModalDndFinalize(columnId: string, e: CustomEvent<{ items: typeof data.tasks }>) {
		dayModalTasksByColumn[columnId] = e.detail.items;
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
	}

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

		<!-- Calendar days with task bars -->
		<div class="relative">
			<!-- Calendar grid -->
			<div class="grid grid-cols-7">
				{#each getCalendarDays() as day, index}
					<div
						class="min-h-[120px] border-b border-r border-gray-200 p-2 {day === null ? 'bg-gray-50' : 'bg-white'}"
						class:border-r-0={(index + 1) % 7 === 0}
					>
						{#if day !== null}
							<div class="flex items-center justify-between mb-1">
								<button
									class="text-sm font-medium cursor-pointer {isToday(day) ? 'bg-sky-500 text-white w-7 h-7 rounded-full flex items-center justify-center' : 'text-gray-700 hover:bg-gray-100 w-7 h-7 rounded-full flex items-center justify-center'}"
									onclick={() => openDayModal(day)}
								>
									{day}
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Task bars overlay -->
			{#each { length: getCalendarRowCount() } as _, rowIndex}
				{@const rowSegments = getSegmentsByRow().get(rowIndex) ?? []}
				{#each rowSegments as segment}
					{@const barColor = getBarColorByColumn(segment.task)}
					<button
						class="absolute h-5 {barColor.bg} {barColor.text} text-xs font-medium px-2 truncate cursor-pointer hover:opacity-80 transition-opacity flex items-center shadow-sm"
						style="
							top: calc({rowIndex} * 120px + 38px + {segment.lane} * 24px);
							left: calc({segment.startCol} * (100% / 7) + 4px);
							width: calc(({segment.endCol - segment.startCol + 1}) * (100% / 7) - 8px);
						"
						class:rounded-l-full={segment.isStart}
						class:rounded-r-full={segment.isEnd}
						class:rounded-l-none={!segment.isStart}
						class:rounded-r-none={!segment.isEnd}
						onclick={() => openTaskDetail(segment.task)}
						title="{segment.task.title} ({(segment.task as any).week_start} → {segment.task.due_date})"
					>
						{#if segment.isStart}
							{segment.task.title}
						{/if}
					</button>
				{/each}
			{/each}
		</div>
	</div>

	<!-- Legend -->
	<div class="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
		<div class="flex items-center gap-2">
			<div class="w-6 h-3 rounded-full bg-rose-300"></div>
			<span>Not Started</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-6 h-3 rounded-full bg-sky-300"></div>
			<span>In Progress</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-6 h-3 rounded-full bg-emerald-300"></div>
			<span>Completed</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-6 h-3 rounded-full bg-gray-300"></div>
			<span>Other</span>
		</div>
		<div class="flex items-center gap-1 text-xs text-gray-500 ml-2">
			<span class="italic">Bars show task duration (assigned → due)</span>
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

<!-- Day Modal with Mini Kanban Board -->
{#if showDayModal && selectedDay}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={closeDayModal}>
		<div class="bg-white rounded-lg w-full max-w-5xl p-6 max-h-[90vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
			<!-- Header -->
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-xl font-bold text-black">{formatSelectedDay()}</h2>
				<button
					class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
					onclick={closeDayModal}
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Mini Kanban Board -->
			<div class="grid gap-4" style="grid-template-columns: repeat({data.columns.length}, minmax(200px, 1fr));">
				{#each data.columns as column}
					<div class="bg-gray-50 rounded-lg p-3">
						<h3 class="font-medium text-gray-700 mb-3 text-sm">{column.name}</h3>
						<div
							class="space-y-2 min-h-[100px] rounded-lg p-1 transition-colors duration-150"
							class:bg-gray-200={hoveredColumnId === column.id}
							use:dndzone={{
								items: getTasksForDayByColumn(column.id),
								flipDurationMs: 0,
								dropTargetStyle: {},
								morphDisabled: true
							}}
							onconsider={(e) => handleDayModalDndConsider(column.id, e)}
							onfinalize={(e) => handleDayModalDndFinalize(column.id, e)}
						>
							{#each getTasksForDayByColumn(column.id) as task (task.id)}
								<div
									class="p-3 bg-sky-100 rounded-lg cursor-grab hover:bg-[#d0ecfd] text-black active:cursor-grabbing"
								>
									<div class="flex items-start justify-between">
										<p class="text-sm font-medium truncate flex-1">{task.title}</p>
										<button
											onclick={(e) => { e.stopPropagation(); closeDayModal(); openTaskDetail(task); }}
											class="text-gray-500 hover:text-gray-900 p-1 -mr-1 -mt-1 transition-colors"
											aria-label="Edit task"
										>
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												<path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
											</svg>
										</button>
									</div>
									{#if task.assignee}
										<p class="text-xs text-gray-600 mt-1">{task.assignee.name}</p>
									{/if}
									{#if task.due_date === getSelectedDayString()}
										<span class="inline-block mt-1 text-xs px-2 py-0.5 bg-rose-100 text-rose-700 rounded">Due</span>
									{:else}
										<span class="inline-block mt-1 text-xs px-2 py-0.5 bg-sky-100 text-sky-700 rounded">Assigned</span>
									{/if}
								</div>
							{/each}
						</div>
						{#if getTasksForDayByColumn(column.id).length === 0}
							<p class="text-xs text-gray-400 text-center py-2">No tasks</p>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
