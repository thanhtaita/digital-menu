# Social Features — User Guide

This guide explains the social features available in the diner app. No technical knowledge needed — just follow the steps below to explore everything.

**The app runs at:** `http://localhost:3003`

---

## Getting Started — Create an Account

1. Go to `http://localhost:3003/register`
2. Enter your email, a display name (optional), and a password
3. Click **Register** — you're logged in automatically
4. Your name appears in the top navigation bar

To log out at any time, click **Log out** in the top bar. To log back in, go to `http://localhost:3003/login`.

> To test social features properly, open a second browser (or an incognito window) and register a **second account** — you'll need two users to follow each other, like posts, etc.

---

## Your Profile Page

**URL:** `http://localhost:3003/u/{your-user-id}`

Your user ID is a number (e.g. `12`). You can find it by logging in and checking the link your display name points to in the top bar.

What you'll see on a profile page:
- **Avatar** — a coloured circle with your initial (automatically generated; you can upload a real photo via the API)
- **Display name** and **bio**
- **Follower / Following counts**
- **Grid of posts** you've written

### Updating your bio

1. Log in and go to `http://localhost:3003/profile`
2. Scroll to your account details — bio editing is available there (or via the PATCH profile endpoint for now; a dedicated UI edit form is planned)

---

## Following Other Users

When you visit **another user's profile** (`/u/{their-id}`), you'll see a **Follow** button if you're logged in and it's not your own profile.

- Click **Follow** — the follower count increases immediately
- Click again (now showing **Unfollow**) to stop following them
- You won't see a Follow button on your own profile

---

## Social Feed

**URL:** `http://localhost:3003/feed`

> Requires being logged in. If you're not, you'll be sent to the login page automatically.

Your feed shows posts from **people you follow** plus your own posts, newest first.

- Scroll through posts
- Click **Load more** at the bottom to fetch older posts
- Each post card shows: author avatar, name, when it was posted, the text, any photos, and like/comment counts

If you haven't followed anyone yet, your feed will only show your own posts. Follow a second account first, then have that account create a post — it will appear in your feed.

---

## Restaurant Pages — Menu & Posts Tabs

**URL:** `http://localhost:3003/r/{restaurant-slug}`

Every restaurant page now has two tabs:

| Tab | What it shows |
|-----|---------------|
| **Menu** | The restaurant's dishes, ingredients, prices (the original experience) |
| **Posts** | Community posts about this restaurant |

Click **Posts** to switch to the community tab. You'll see all posts people have tagged to that restaurant.

### Writing a post about a restaurant

1. Go to a restaurant page and click the **Posts** tab
2. Click **Write a post**
3. Type your review, check-in, or comment (up to 2,000 characters)
4. Optionally attach up to **5 photos** using the photo button
5. Click **Post** — your post appears at the top of the list

> You must be logged in to write a post.

---

## Post Detail Page

**URL:** `http://localhost:3003/posts/{post-id}`

Click the comment count on any post card to open the full post detail view. Here you'll find:

- The full post content
- A **photo carousel** if the post has multiple images (use the arrows or dots to navigate)
- **Like count** and a like button
- The full **comment thread**

### Liking a post

Click the heart icon on any post card or on the post detail page. The count updates instantly. Click again to unlike.

### Comments and Replies

On the post detail page:
1. Type in the **Add a comment** box at the bottom and press **Post comment**
2. Your comment appears in the list
3. Click **Reply** under any comment to write a reply — replies are shown nested under the original comment (one level deep)
4. Click **Delete** on your own comments to remove them

---

## Quick Test Walkthrough (Two Users)

Use two browser windows — one for **User A**, one for **User B**.

1. **Register User A** in window 1 → note their user ID from the nav bar link
2. **Register User B** in window 2 → note their user ID
3. **User B visits User A's profile** → `http://localhost:3003/u/{A's id}` → clicks **Follow**
4. **User A creates a post** → go to any restaurant's Posts tab → write something
5. **User B checks their feed** → `http://localhost:3003/feed` → User A's post appears
6. **User B likes the post** → heart icon on the card
7. **User B leaves a comment** → click the post → add a comment
8. **User A replies** → log in as A in a third window or swap sessions → reply to B's comment
9. **Check User A's profile** → `http://localhost:3003/u/{A's id}` → see the post in the grid, follower count = 1

---

## Summary of All Social URLs

| URL | What it's for | Login required? |
|-----|--------------|-----------------|
| `/register` | Create a new account | No |
| `/login` | Log in | No |
| `/profile` | Your dietary restrictions and preferences | Yes |
| `/feed` | Posts from people you follow | Yes |
| `/u/{userId}` | Any user's public profile and post grid | No (follow button needs login) |
| `/posts/{postId}` | Full post with photo carousel and comments | No (like/comment needs login) |
| `/r/{slug}` | Restaurant menu (default tab) | No |
| `/r/{slug}?tab=posts` | Restaurant community posts | No (writing needs login) |
