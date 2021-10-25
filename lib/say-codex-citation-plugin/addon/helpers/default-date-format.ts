import { helper } from '@ember/component/helper';

export function defaultDateFormat([date] : [date:Date]/*, hash*/) {
  try {
    const options = { year: 'numeric', month: 'numeric', day: 'numeric' };
    return date.toLocaleDateString('nl-BE', options);
  }
  catch(e) {
    console.error(e);
    return date;
  }
}

export default helper(defaultDateFormat);
