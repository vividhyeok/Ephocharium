import { handleEpi } from "../server/epi.js";
export default { fetch: (request: Request) => handleEpi(request) };
