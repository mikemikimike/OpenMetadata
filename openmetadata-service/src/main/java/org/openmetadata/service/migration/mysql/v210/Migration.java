package org.openmetadata.service.migration.mysql.v210;

import static org.openmetadata.service.migration.utils.v210.SearchNameKeywordRepair.repairNameKeywordSearchFields;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    // Issue #31261: restore name.keyword on database/storedProcedure/query/metric so exact-match
    // name search works on upgraded clusters. The settings merge never rewrites a known asset
    // type, so the seed change alone does not reach existing installs. Idempotent.
    repairNameKeywordSearchFields();
  }
}
