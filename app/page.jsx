import { redirect } from "next/navigation";
import { getAccess } from "../lib/access";
import CentralComercialApp from "../components/CentralComercialApp";
import { AccessPending } from "../components/AccessPending";
export const dynamic="force-dynamic";
export default async function Page() {
 let access;
 try{access=await getAccess();}
 catch{return <AccessPending state="unavailable"/>;}
 if(!access.signedIn)redirect("/auth/sign-in");
 if(!access.allowed) return <AccessPending state={access.suspended?"suspended":!access.verified?"unverified":access.hasInvitation?"invited":"pending"}/>;
 return <CentralComercialApp accessRole={access.role}/>;
}
