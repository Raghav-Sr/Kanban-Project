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

## Development Commands

```bash
npm run dev          # Start dev server at localhost:5173
npm run build        # Build for production
npm run preview      # Preview production build
npm run check        # Type-check the codebase
npm run lint         # Run linter
```

## Environment Variables

Copy `.env.example` to `.env` and add your Supabase credentials:
- `PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key

## Design System

**Colors**
- Background: White (`bg-white`)
- Text: Black (`text-black`)
- Task Cards: Light blue (`bg-sky-100`, hover: `bg-sky-200`)
- Columns: Light gray (`bg-gray-100`)
- Primary Buttons: Sky blue (`bg-sky-500`, hover: `bg-sky-600`)
- Secondary Text: Gray (`text-gray-500`, `text-gray-600`)

**Typography**
- Headings: Bold, black text
- Body: Regular weight, black text
- Secondary info: Gray text (`text-gray-500`)

**Spacing**
- Follow Tailwind spacing scale (4px base): `p-2`, `m-4`, `gap-6`
- Task cards: `p-3`
- Sections: `p-6`

**Sizing**
- Columns: Fixed width `w-80` (320px)
- Add button: `w-7 h-7` rounded circle
- Touch targets: Minimum 44px for interactive elements

**Components**
- Task cards: Rounded corners (`rounded-lg`), light blue background
- Columns: Rounded containers with gray background
- Modals: Card-style with white background
- Buttons: Rounded, sky blue for primary actions

## Best Practices

- Always write component code
- File length should be no more than 800 lines (avoid monster code)
- Avoid hard coding mock data
