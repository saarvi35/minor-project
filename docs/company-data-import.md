# Company data import

Owners can configure a new company without manually adding every record. Open **Data Import** in the owner dashboard, download the Excel template, fill it, choose **Validate and preview**, and then choose **Confirm import**.

The workbook has three required tabs:

- `Employees`: `name`, `email`, `role`, `department`, `designation`, `status`
- `Projects`: `name`, `description`, `manager_email`, `client_email`, `priority`, `status`, `start_date`, `end_date`, `budget`, `actual_cost`
- `Tasks`: `title`, `description`, `project_name`, `assigned_to_email`, `priority`, `status`, `progress`, `due_date`, `reference_link`

Use `YYYY-MM-DD` for all dates. Employees should be listed before a project refers to their email. The importer creates departments when needed and uses the email fields to connect members, projects, and tasks.

The preview checks rows before any database write. The confirmed import only creates or updates records inside the logged-in owner's company. An email already attached to another company tenant is rejected.

For Google Sheets, share the sheet as **Anyone with the link can view**, make sure the tabs are named `Employees`, `Projects`, and `Tasks`, then paste the share link into the Google Sheets import field. The server downloads a temporary Excel representation of that sheet; it does not save the public link or grant third-party access to the platform.

CSV is supported for an Employees-only roster. Use the workbook template for full company setup.
