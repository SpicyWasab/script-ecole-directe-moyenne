// IMPORTS
import fetch from 'node-fetch';
import prompt from 'prompt-promise';
import ora from 'ora';

// MAIN PART
// prompt for credentials
const username = await prompt('Identifiant : ');
const password = await prompt.password('Mot de passe : ');

// login to ecoledirecte
let loginSpinner = ora({
    color: 'blue', // ecoledirecte is blue
    text: 'Connexion à EcoleDirecte ...'
}).start();

const loginRes = await fetch('https://api.ecoledirecte.com/v3/login.awp', {
    method: 'post',
    body: parseBody({
        identifiant: username,
        motdepasse: password
    }),
    // apparently, ecoledirecte specifically doesn't like the 'node-fetch' agent, so let's use another user-agent xD
    headers: getHeader()
});

// get token, message and datas
const { token, message, data } = await loginRes.json();

// if no token (fail) -> panic with message
if(!token) panic(message, loginSpinner);

// otherwise, get the firstname, lastname and id
const { nom, prenom, id } = data.accounts[0];

// succeed the spinner
loginSpinner.succeed(`Connecté à EcoleDirecte - ${nom} ${prenom}`);

// fetch notes
const notesSpinner = ora({
    color: 'blue', // ecoledirecte is still blue :)
    text: 'Récupération des notes ...'
}).start();

const notesRes = await fetch(`https://api.ecoledirecte.com/v3/eleves/${id}/notes.awp?verbe=get`, {
    method: 'post',
    body: parseBody({
        token
    }),
    headers: getHeader()
});

// get the code, msg, and notes
const { code, msg, data: { notes } } = await notesRes.json();

// if code is not 200 (success) panic
if(code != 200) panic(msg, notesSpinner);

notesSpinner.succeed('Les notes ont été récupérées avec succès');

// notes / matieres
let notesParMatieres = { };

// available periods
const availablePeriods = [...(new Set(notes.map(note => note.codePeriode)))];

// display available periods
console.table(availablePeriods);

// ask for the period index (default is the last period, which is the current period (I think :thinking:))
const periodIndex = await safePromptNumber('Index de la période (semestre, trimestres, etc ...) dont vous voulez obtenir les moyennes :',
    availablePeriods.length - 1,
    (value) => parseInt(index) < 0 || parseInt(index) >= availablePeriods.length
);

const period = availablePeriods[periodIndex];

// ask for over (note/over) (default is 20)
let over = await safePromptNumber('Sur combien voulez-vous obtenir les moyennes ?', 20, (value) => !isNaN(value));

// ask for precision (digits after point) (default is 2)
let precision = await safePromptNumber('Veuillez entrer une précision (nombre de chiffres après la virgule) :', 1, (value) => !isNaN(value));

// for each note
for(const noteDatas of notes) {
    // get the matiere, period, noteOver, value, coef, isANumberOrALetter (eg: 'Abs' -> absent)
    const { libelleMatiere, codePeriode, noteSur, valeur, coef, enLettre } = noteDatas;

    // if not selected period, skip
    if(codePeriode != period) continue;
    // if not already in notes / matieres, add an entry to notes / matieres
    if(!(libelleMatiere in notesParMatieres)) notesParMatieres[libelleMatiere] = [ ];
    // if not numeric (eg: 'Abs'), skip
    if(enLettre) continue;
    
    // a simple function to transform '17,4' type number to actual float
    const getFloat = (numberString) => parseFloat(numberString.replace(',', '.'));

    // push the matiere entry
    notesParMatieres[libelleMatiere].push({
        value: getFloat(valeur) / getFloat(noteSur), // value
        coef: getFloat(coef) // coef
    });
}

// the object that will be displayed to the end user
let displayedMoyennes = { };

// moyenne generale
let moyenneGenerale = 0;
// i (we're assuming every matiere is coef 1)
let i = 0;

// for every matiere entry (notes)
for(const matiere in notesParMatieres) {
    const notes = notesParMatieres[matiere];

    // if no note, moyenne is undefined
    if(notesParMatieres.length === 0) displayedMoyennes[matiere] = undefined;
    
    // sum of notes, sum of coefs
    let sommeNotes = 0;
    let sommeCoefs = 0;

    // for every note
    for(const note of notes) {
        sommeNotes += note.value * note.coef; // sum notes
        sommeCoefs += note.coef; // sum coef
    }

    // calculate the moyenne
    const moyenne = sommeNotes / sommeCoefs * over;
    
    displayedMoyennes[matiere] = moyenne.toFixed(precision);
    moyenneGenerale += moyenne;
    i++;
}

// sort the moyennes from the best to the worst :
displayedMoyennes = Object.fromEntries((Object.entries(displayedMoyennes)).sort((a, b) => {
    return parseFloat(b[1]) - parseFloat(a[1]);
}));

// calculate moyenne generale
moyenneGenerale /= i;
displayedMoyennes['MOYENNE GENERALE'] = moyenneGenerale.toFixed(precision);

// display all moyennes
console.table(displayedMoyennes);

// successfully terminate the process
process.exit(0);


// FUNCTIONS BELOW THIS LINE

function parseBody(body) {
    return `data=${JSON.stringify(body)}`
}

/**
 * Stop the spinner, and exit the program with error code 1
 * @param {String} text 
 * @param {import('ora').Ora} spinner 
 */
function panic(text, spinner) {
    spinner.fail(text);
    process.exit(1);
}

function getHeader() {
    return { 'User-Agent': "Bonjour EcoleDirecte. Je veux juste calculer ma moyenne en utilisant node.js, mais apparemment l'user agent 'node\\-fetch' (celui par défaut en utilisant le module 'node\\-fetch') ne vous convient pas (c'est d'ailleurs pour ça que je mets un antislash en plein milieu, sinon ça ne fonctionne pas ...). Permettez-moi donc d'utiliser autre chose. (Bonne journée à vous si quelqu'un lit ce message :))" };
}

/**
 * Prompt for a number until value is successfully verified
 * @param {String} text the text displayed to the user
 * @param {*} defaultValue the default value, if nothing is provided
 * @param {Function} verify function to verify the value
 */
async function safePromptNumber(text, defaultValue, verify) {
    while(true) {
        const value = await prompt(`${text} (defaut : ${defaultValue}) `);
    
        // if nothing selected, break, so default choice
        if(!value) return defaultValue;
    
        // if doesn't successfully verified, reprompt
        if(!verify(value)) continue;
    
        return parseInt(value);
    }
}
