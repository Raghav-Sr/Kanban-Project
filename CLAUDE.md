# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A household task management Kanban board for families and roommates sharing a living space. Prevents confusion about who does what, tracks progress, and maintains accountability.

## Core Features

- **Quick Task Creation**: Add tasks with title, assignee, due date, and column placement
- **Weekly Kanban Board**: View tasks organized by status (Not Started, In Progress, Completed) with date picker and week navigation
- **Customizable Columns**: Add custom columns beyond the three base statuses
- **Drag-and-Drop**: Move cards between columns to update status
- **Task Details**: Click cards to edit info, manage subtasks, archive, or delete

## Navigation

1. User adds a task by entering name, assignee, due date, and selecting a column
2. After adding tasks, user is taken to the Kanban view showing the current week with date picker and week label
3. In Kanban view, user can add tasks to any of the three base columns (Not Started, In Progress, Completed), add custom columns, and drag cards between statuses
4. Clicking a card opens a detailed view for editing info, managing subtasks, archiving, or deleting

## Tech Stack

- **Frontend**: SvelteKit
- **Database**: Supabase (Postgres)
- **Auth**: Supabase Auth
- **Drag-and-Drop**: svelte-dnd-action
- **UI Library**: Skeleton UI (Tailwind-based)

## Design System

Using Skeleton UI's design tokens for consistency:

**Typography**
- Uses Skeleton's default font stack or custom theme fonts
- Headings: `font-heading-token` classes
- Body: `font-token` classes

**Colors**
- Primary: Action buttons, active states, links
- Secondary: Supporting UI elements
- Surface: Cards, backgrounds
- Use semantic color tokens (`text-primary-500`, `bg-surface-200`, etc.)

**Spacing**
- Follow Tailwind spacing scale (4px base): `p-2`, `m-4`, `gap-6`
- Consistent padding: Cards use `p-4`, sections use `p-6`

**Sizing**
- Cards: Consistent min-width for Kanban cards
- Columns: Flexible width with min/max constraints
- Touch targets: Minimum 44px for interactive elements

**Components** (from Skeleton UI)
- AppBar, AppShell for layout
- Cards for task items
- Modals for task detail view
- Buttons, Inputs, Select for forms
- Chips/Badges for labels and assignees

## Best Practices

- Always write component code
- File length should be no more than 800 lines (avoid monster code)
- Avoid hard coding mock data
