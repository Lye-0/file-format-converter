import HomeShell from "@/components/HomeShell";

type PageProps = {
  searchParams?:
    | Promise<{
        tab?: string | string[];
      }>
    | {
        tab?: string | string[];
      };
};

export default async function Page({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams ?? {});
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;

  const initialTab = rawTab === "edit" ? "edit" : "convert";

  return <HomeShell initialTab={initialTab} />;
}