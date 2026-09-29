import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
      <div className="fixed bottom-0 left-0 mb-4 flex h-auto w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:w-auto lg:bg-none lg:mb-0">
        <Link
          href="/"
          className="flex items-center justify-center font-nunito text-lg font-bold gap-2"
        >
        <Image
          className="rounded-xl"
          src="/llama.png"
          alt="Llama Logo"
          width={40}
          height={40}
          priority
        />
          <span>LlamaIndex & Azure AI Vector Search</span>
        </Link>
      </div>
    </div>
  );
}
