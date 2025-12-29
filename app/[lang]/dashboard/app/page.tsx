import { notFound } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { SubmitApplicationForm } from "@/components/forms/submit-application-form";
import { AllSubmitAppConfigs } from "@/config/submit-app";
import { COMMON_PARAMS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { AppTypeListQueryResult, UserQueryResult } from "@/lib/cms/types";
import { fetchUser, fetchAppTypeList } from "@/lib/cms/fetch";

export const metadata = {
  title: "Submit Application",
  description: "Submit your indie applications to share.",
}

export default async function SubmitApplicationPage({ params }: { params: { lang: string }; }) {
  const { lang } = params;
  const pageConfig = AllSubmitAppConfigs[lang];
  console.log('AppListPage, lang:', lang);
  // console.log('AppListPage, lang:', lang, 'pageConfig:', pageConfig);
  const queryParams = { ...COMMON_PARAMS, lang };
  // console.log('AppListPage, language:', lang); // language: en
  // console.log('AppListPage, queryParams:', queryParams); // queryParams: { defaultLocale: 'en', lang: 'en' }

  const user = await getCurrentUser();
  if (!user) {
    console.log("SubmitApplicationPage, user not found");
    return notFound();
  }
  console.log('SubmitApplicationPage, userid:', user.id);

  const [appTypeListQueryResult, userQueryResult] = await Promise.all([
    fetchAppTypeList({
      locale: lang as any,
      params: queryParams,
    }),
    fetchUser({
      userId: user.id,
      locale: lang as any,
      options: { useCache: false },
    }),
  ]);
  if (!userQueryResult) {
    console.log("SubmitApplicationPage, userQueryResult not found");
    return notFound();
  }
  console.log('SubmitApplicationPage, sanityUser id:', userQueryResult._id, ' name:', userQueryResult.name);

  return (
    <DashboardShell>
      <DashboardHeader
        heading={pageConfig.title}
        text={pageConfig.subtitle}
      />
      <div className="grid gap-10">
        <SubmitApplicationForm lang={lang}
          user={{ id: user.id, name: user.name || "" }}
          appTypeList={appTypeListQueryResult}
          sanityUser={userQueryResult} />
      </div>
    </DashboardShell>
  )
}
