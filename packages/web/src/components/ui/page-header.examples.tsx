import { Button } from "./button";
import { PageHeader } from "./page-header";

export function PageHeaderExample() {
  return (
    <PageHeader
      title="Dashboard"
      description="Monitor article operations."
      actions={<Button type="button">New article</Button>}
    />
  );
}
