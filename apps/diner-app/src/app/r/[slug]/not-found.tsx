import Link from "next/link";

export default function MenuNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-semibold text-stone-900">We couldn&apos;t find this menu</h1>
      <p className="mt-2 text-stone-600">The restaurant may be inactive or the link is incorrect.</p>
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-stone-800 underline">
        Home
      </Link>
    </div>
  );
}
