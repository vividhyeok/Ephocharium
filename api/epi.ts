import { handleEpi } from "../server/epi";
export default { fetch: (request: Request) => handleEpi(request) };
