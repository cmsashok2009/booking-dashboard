import { buildSingleUserPayload, validateSingleUser } from "./singleUser";
import { downloadUsersExcel } from "../../utils/exportExcel";
import { request } from "../../utils/api";

export function createUserActions(context) {
  const {
    setUserTable,
    setUserPage,
    setBootstrap,
    filteredUsers,
    setNotice,
    bootstrap,
    setSingleUserErrors,
    loadBootstrap,
    setSingleUserModalOpen,
    setOnboardingWorkflowId,
    setBulkUserModalOpen,
    setSingleUserRole
  } = context;
  function updateUserFilters(patch) {
    setUserTable((current) => ({ ...current, ...patch }));
    setUserPage(1);
  }

  function sortUsers(key) {
    setUserTable((current) => ({
      ...current,
      sortKey: key,
      sortDir: current.sortKey === key && current.sortDir === "asc" ? "desc" : "asc"
    }));
    setUserPage(1);
  }

  function userUpdated(updatedUser) {
    setBootstrap((current) => ({
      ...current,
      users: current.users.map((item) => (item.id === updatedUser.id ? updatedUser : item))
    }));
  }

  async function downloadUsers() {
    try {
      await downloadUsersExcel(filteredUsers);
      setNotice({ type: "success", message: `${filteredUsers.length} users downloaded.` });
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Unable to download users." });
    }
  }
  async function createSingleUser(values) {
    const clientErrors = validateSingleUser(values, bootstrap?.roleDefinitions || []);
    setSingleUserErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;
    try {
      const result = await request("/api/admin/onboarding/single", {
        method: "POST",
        body: JSON.stringify(buildSingleUserPayload(values, bootstrap?.roleDefinitions || []))
      });
      await loadBootstrap();
      setSingleUserModalOpen(false);
      setOnboardingWorkflowId(result.id);
      setBulkUserModalOpen(true);
      setUserPage(1);
      setNotice({
        message: result.resumed
          ? "Pending onboarding resumed. Continue from the saved invitation step."
          : "User created as pending invitation. Choose an activation template to continue.",
        type: "success"
      });
    } catch (error) {
      const serverErrors = Object.fromEntries(
        (error.payload?.errors || []).map((item) => [item.columnName, item.errorMessage])
      );
      setSingleUserErrors(serverErrors);
      const details = error.payload?.errors?.map((item) => `${item.columnName}: ${item.errorMessage}`).join("; ");
      setNotice({ message: details || error.message, type: "error" });
    }
  }

  function changeSingleUserRole(role) {
    setSingleUserRole(role);
    setSingleUserErrors((current) => ({
      ...current,
      Role: undefined,
      Region: undefined,
      "Reporting Manager Email": undefined
    }));
  }
  return {
    updateUserFilters,
    sortUsers,
    userUpdated,
    downloadUsers,
    createSingleUser,
    changeSingleUserRole
  };
}
