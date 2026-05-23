const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');
code = code.replace(/data-text=t\("you_mogged"\)>/g, 'data-text={t("you_mogged")}>');
code = code.replace(/data-text=t\("got_mogged"\)>/g, 'data-text={t("got_mogged")}>');
fs.writeFileSync('src/App.jsx', code);
console.log('Fixed');
