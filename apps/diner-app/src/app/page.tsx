export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-stone-900">Digital menu</h1>
      <p className="mt-2 text-stone-600">
        Open your restaurant&apos;s public menu at{" "}
        <code className="rounded bg-stone-100 px-1.5 py-0.5 text-sm">/r/your-slug</code>.
      </p>
    </div>
  );
}
