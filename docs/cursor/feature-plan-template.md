### Feature Plan Template (for Cursor)

Use this template as a starting point whenever you add a new feature. You can paste it into a new `plan.md` or a chat and fill it in.

---

#### 1. Feature overview

- **Feature name**: <!-- e.g. Admin: Restaurant menu CRUD -->
- **Summary**: <!-- 2–4 sentences describing what this feature delivers and for whom -->
- **Success criteria**:
  - <!-- e.g. Admin can create/edit/delete menus and sections -->
  - <!-- e.g. Diner can see up-to-date menu for a restaurant -->

---

#### 2. Implementation steps (8–12 small, testable items)

Fill in with small, concrete steps. Each step should be completable in one focused Cursor task.

1. **Step 1** — <!-- short description -->
   - Impacted areas/files: <!-- e.g. apps/api/src/routes/... -->
   - Expected outcome: <!-- what will work after this step -->
2. **Step 2** — <!-- short description -->
   - Impacted areas/files:
   - Expected outcome:
3. **Step 3** — <!-- short description -->
   - Impacted areas/files:
   - Expected outcome:
4. **Step 4** — <!-- short description -->
   - Impacted areas/files:
   - Expected outcome:
5. **Step 5** — <!-- short description -->
   - Impacted areas/files:
   - Expected outcome:
6. **Step 6** — <!-- short description -->
   - Impacted areas/files:
   - Expected outcome:
7. **Step 7** — <!-- short description -->
   - Impacted areas/files:
   - Expected outcome:
8. **Step 8** — <!-- short description -->
   - Impacted areas/files:
   - Expected outcome:
9. **(Optional) Step 9+** — <!-- add more steps as needed, but keep total under ~12 -->

---

#### 3. Testing plan

Describe how you will verify this feature works end-to-end.

- **Unit tests**:
  - <!-- Which functions/modules will get unit tests? In which files? -->
- **Integration tests**:
  - <!-- Which API routes or flows will get integration tests? -->
- **E2E / manual tests**:
  - <!-- Critical manual or Playwright flows you will run, e.g. "admin creates menu and diner sees it" -->

---

#### 4. Risks, constraints, and edge cases

- **Constraints**:
  - <!-- e.g. Must preserve backward compatibility for existing routes -->
  - <!-- e.g. Must not break diner app SEO behavior -->
- **Risks / tricky parts**:
  - <!-- e.g. Complex auth/role edge cases, data migrations, performance concerns -->
- **Key edge cases**:
  - <!-- e.g. Empty menus, deleted sections, no ingredients, unauthorized users -->

---

#### 5. How to use this plan with Cursor

You can use the following prompts to manage this plan in Cursor:

- **Generate the initial plan**
  - “Using `docs/cursor/feature-plan-template.md` as a guide, create a concise feature plan for **[feature name]**. Keep it to 8–12 implementation steps plus a testing plan and risks section.”

- **Implement a single step**
  - “Work only on **Step N** of the feature plan for **[feature name]**. Modify only: **[list of files/areas, e.g. `apps/api/src/routes/menus.ts` and related Zod schemas in `packages/shared`]**. Follow ` .cursor/rules/global.md`. Prefer small, focused diffs over rewrites.”

- **Update the plan after changes**
  - “Given what we’ve implemented so far for **[feature name]**, update the feature plan: mark completed steps, adjust remaining steps if needed, and keep the list under ~12 total steps.”

