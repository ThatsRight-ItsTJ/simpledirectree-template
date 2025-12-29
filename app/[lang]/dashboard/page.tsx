import { notFound } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { AccountInfoForm } from "@/components/forms/account-info-form";
import { AllSettingsConfigs } from "@/config/settings";
import { getCurrentUser } from "@/lib/session";
import { UserQueryResult } from "@/lib/cms/types";
import { fetchUser } from "@/lib/cms/fetch";

export const metadata = {
  title: "Settings",
  description: "Manage account and website settings.",
}

export default async function SettingsPage({ params }: { params: { lang: string }; }) {
  const { lang } = params;
  const pageConfig = AllSettingsConfigs[lang];
  // console.log('SettingsPage, lang:', lang);
  // console.log('SettingsPage, lang:', lang, 'pageConfig:', pageConfig);

  const user = await getCurrentUser();
  if (!user) {
    console.log("SettingsPage, user not found");
    return notFound();
  }

  console.log('SettingsPage, userid:', user.id, 'username:', user.name);
  const userQueryResult = await fetchUser({
    userId: user.id,
    locale: lang as any,
    options: { useCache: false },
  });
  if (!userQueryResult) {
    console.log("SettingsPage, userQueryResult not found");
    return notFound();
  }
  console.log('SettingsPage, sanityUser id:', userQueryResult._id, ' name:', userQueryResult.name);

  return (
    <DashboardShell>
      <DashboardHeader
        heading={pageConfig.title}
        text={pageConfig.subtitle}
      />
      <div className="grid gap-10">
        <AccountInfoForm lang={lang}
          user={{ id: user.id, name: user.name || "" }}
          sanityUser={userQueryResult} />
      </div>
    </DashboardShell>
  )
}
