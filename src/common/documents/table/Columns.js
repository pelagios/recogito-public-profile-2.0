// Columns available in all views
const COLUMNS_GENERAL = [
  // Aggregate fields
  // 'agg_document',

  // Common fields
  'author',
  'title',
  'language',
  'date_freeform',
  'uploaded_at',
  'last_edit_at',
  'last_edit_by',
  'my_last_edit_at',
  'annotations',
  'my_annotations',
  'public_visibility',
  'status_ratio',
  'cloned_from',
  'has_clones'
];

// Columns specific to SHARED_WITH_ME view
const COLUMNS_SHARED_WITH_ME = [
  'owner',
  'shared_by',
  'access_level'
];

export const COLUMNS = COLUMNS_GENERAL.concat(COLUMNS_SHARED_WITH_ME);

// Labels to use for fields
export const HEADER_NAMES = {
  // agg_document    : 'Document',

  author            : 'Author',
  title             : 'Title',
  language          : 'Language',
  date_freeform     : 'Date',
  uploaded_at       : 'Uploaded at',
  last_edit_at      : 'Last edit',
  last_edit_by      : 'Last edit by',
  my_last_edit_at   : 'My last edit',
  annotations       : 'Annotations',
  my_annotations    : 'My annotations',
  public_visibility : 'Visibility',
  status_ratio      : 'Verification ratio',
  cloned_from       : 'Cloned from',
  has_clones        : 'Has clones',

  owner             : 'Document owner',
  shared_by         : 'Shared by',
  access_level      : 'Access'
};

// Relative width requirements per column (XL, L, M, S)
export const COLUMN_WIDTH = {
  agg_document    : 'XL',

  author            : 'M',
  title             : 'L',
  language          : 'M',
  date_freeform     : 'M',
  uploaded_at       : 'M',
  last_edit_at      : 'M',
  last_edit_by      : 'M',
  my_last_edit_at   : 'M',
  annotations       : 'M',
  my_annotations    : 'M',
  public_visibility : 'M',
  status_ratio      : 'M',
  cloned_from       : 'M',
  has_clones        : 'S',

  owner             : 'M',
  shared_by         : 'M',
  access_level      : 'M'
};

export const AGGREGATE_COLUMNS = {
  agg_document: [ 'author', 'document' ]
};

// Static helper methods 
export class Columns {

  static getSpan(field) {
    const w = COLUMN_WIDTH[field];
    if (w === 'XL') 
      return 6;
    else if (w === 'L')
      return 4;
    else if (w === 'M')
      return 2;
    else if (w === 'S')
      return 1;
  }

  /** Expands agg_ columns to those that are required to build them **/
  static expandAggregatedColumns(columns) {
    return columns.reduce((result, field) => {
      if (field.startsWith('agg_'))
        result = result.concat(AGGREGATE_COLUMNS[field]);
      else
        // Just append
        result.push(field);

      return result;
    }, []);
  }

  /** Removes the columns that are not applicable in the given view **/
  static filterByView(columns, view) { 
    if (view === 'MY_DOCUMENTS')
      // Remove columns specific to 'Shared With Me'
      return columns.filter(c => !COLUMNS_SHARED_WITH_ME.includes(c));
    else
      // All
      return columns; 
  }

}