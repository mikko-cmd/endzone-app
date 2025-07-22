import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Welcome to the App</h1>
      <div className="flex gap-4">
        <Link href="/auth/login" className="px-4 py-2 bg-blue-500 text-white rounded-md">
          Login
        </Link>
        <Link href="/auth/signup" className="px-4 py-2 bg-green-500 text-white rounded-md">
          Sign Up
        </Link>
      </div>
    </main>
  );
} 