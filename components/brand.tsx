import Link from "next/link";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="QuiZone home">
      <span className="brandmark" aria-hidden="true">
        Q<span />
      </span>
      <span>
        QuiZone<span className="branddot">.</span>
      </span>
    </Link>
  );
}
