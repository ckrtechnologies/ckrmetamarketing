require('dotenv').config();
const supabase = require('./src/utils/supabase');
async function run() {
  const { data, error } = await supabase
    .from('conversations')
    .update({ waba_id: '4202e2af-b17a-4a92-a0b2-9fc1b25b25d9' })
    .neq('waba_id', '4202e2af-b17a-4a92-a0b2-9fc1b25b25d9');
  console.log(error || 'Updated');
}
run();
