import {
  auth, db, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, doc, getDoc, setDoc, updateDoc,
  addDoc, collection, query, where, onSnapshot, serverTimestamp,
  changerMotDePasse,
} from "./firebase-config.js";

import { formatDate, formatMontant, notifier } from "./utils.js";

const state = {
  currentUser: null,
  associationId: null,
  cotisations: [],
  communications: [],
  unsubscribers: [],
};
let creationEnCours = false;

const screens = ["screen-loading", "screen-login", "screen-inscription", "screen-dashboard"];
function showScreen(id) {
  screens.forEach((s) => document.getElementById(s).classList.toggle("hidden", s !== id));
}

function telephoneVersEmailTechnique(telephone) {
  const chiffres = telephone.replace(/\D/g, "");
  return `${chiffres}@membre.botaye.local`;
}

function demarrer() {
  showScreen("screen-loading");
  onAuthStateChanged(auth, async (user) => {
    if (creationEnCours) return;
    if (user) {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists() && userSnap.data().role === "membre") {
        state.currentUser = { uid: user.uid, ...userSnap.data() };
        state.associationId = userSnap.data().association_id;
        await lancerDashboard();
        return;
      } else {
        await signOut(auth);
      }
    }
    showScreen("screen-login");
  });
}

document.getElementById("lien-vers-inscription").addEventListener("click", () => {
  showScreen("screen-inscription");
});
document.getElementById("lien-retour-login").addEventListener("click", () => {
  showScreen("screen-login");
});

document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = telephoneVersEmailTechnique(fd.get("telephone").trim());
  try {
    await signInWithEmailAndPassword(auth, email, fd.get("password"));
  } catch (err) {
    notifier("Téléphone ou mot de passe incorrect.", "erreur");
  }
});

document.getElementById("form-inscription").addEventListener("submit", async (e) => {
  e.preventDefault();
  const inscError = document.getElementById("inscError");
  inscError.textContent = "";
  const fd = new FormData(e.target);
  const code = fd.get("code").trim().toUpperCase();
  const nom = fd.get("nom").trim();
  const telephone = fd.get("telephone").trim();
  const residence = fd.get("residence").trim();
  const password = fd.get("password");

  if (!code.startsWith("MBR-")) {
    inscError.textContent = "Ce code ne correspond pas à un code d'invitation d'association (MBR-...).";
    return;
  }

  creationEnCours = true;
  try {
    const codeRef = doc(db, "codes_parrainage", code);
    const codeSnap = await getDoc(codeRef);

    if (!codeSnap.exists() || codeSnap.data().type !== "membre" || codeSnap.data().actif !== true) {
      inscError.textContent = "Code invalide, déjà utilisé, ou expiré. Contactez votre bureau.";
      creationEnCours = false;
      return;
    }

    const codeData = codeSnap.data();
    const associationId = codeData.association_id;
    const coordinationId = codeData.coordination_id;
    const familyIdCible = codeData.family_id_cible || null;
    const emailTechnique = telephoneVersEmailTechnique(telephone);

    const cred = await createUserWithEmailAndPassword(auth, emailTechnique, password);

    const userData = {
      role: "membre",
      nom, telephone, residence,
      association_id: associationId,
      coordination_id: coordinationId,
      family_id: familyIdCible,
      statut: "actif",
      date_creation: serverTimestamp(),
    };
    await setDoc(doc(db, "users", cred.user.uid), userData);
    await updateDoc(codeRef, { actif: false, utilise_par: cred.user.uid });

    if (familyIdCible) {
      await updateDoc(doc(db, "families", familyIdCible), {
        chef_membre_id: cred.user.uid,
        en_attente_chef: false,
      });
    }

    notifier("Compte créé avec succès.", "succes");
    state.currentUser = { uid: cred.user.uid, ...userData };
    state.associationId = associationId;
    creationEnCours = false;
    await lancerDashboard();
  } catch (err) {
    notifier("Erreur : " + err.message, "erreur");
    if (auth.currentUser) {
      try { await auth.currentUser.delete(); } catch (e2) { /* ignore */ }
      try { await signOut(auth); } catch (e3) { /* ignore */ }
    }
    creationEnCours = false;
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  state.unsubscribers.forEach((u) => u());
  state.unsubscribers = [];
  await signOut(auth);
  showScreen("screen-login");
});

document.getElementById("btn-changer-mdp").addEventListener("click", () => {
  ouvrirModal(`
    <h2>Changer mon mot de passe</h2>
    <p class="subtitle-sm">Confirmez votre mot de passe actuel puis saisissez le nouveau.</p>
    <form id="form-changer-mdp">
      <div class="field-row">
        <label>Mot de passe actuel</label>
        <input type="password" name="ancien" required />
      </div>
      <div class="field-row">
        <label>Nouveau mot de passe (6 caractères min)</label>
        <input type="password" name="nouveau" minlength="6" required />
      </div>
      <div class="field-row">
        <label>Confirmer le nouveau mot de passe</label>
        <input type="password" name="confirmation" minlength="6" required />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost-sm" id="modal-annuler" style="flex:1;">Annuler</button>
        <button type="submit" class="btn btn-primary" style="flex:1;">Confirmer</button>
      </div>
    </form>
  `);
  document.getElementById("modal-annuler").addEventListener("click", fermerModal);
  document.getElementById("form-changer-mdp").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const ancien = fd.get("ancien");
    const nouveau = fd.get("nouveau");
    const confirmation = fd.get("confirmation");
    if (nouveau !== confirmation) {
      notifier("Les deux mots de passe ne correspondent pas.", "erreur");
      return;
    }
    try {
      const emailTechnique = telephoneVersEmailTechnique(state.currentUser.telephone);
      await changerMotDePasse(emailTechnique, ancien, nouveau);
      notifier("Mot de passe modifié avec succès.", "succes");
      fermerModal();
    } catch (err) {
      notifier("Mot de passe actuel incorrect ou erreur : " + err.message, "erreur");
    }
  });
});

async function lancerDashboard() {
  showScreen("screen-dashboard");
  document.getElementById("db-membre-nom").textContent = state.currentUser.nom;

  try {
    const assocSnap = await getDoc(doc(db, "associations", state.associationId));
    if (assocSnap.exists()) {
      document.getElementById("db-association-nom").textContent = assocSnap.data().nom;
    }
  } catch (e) { /* ignore */ }

  const unsubCotisations = onSnapshot(
    query(collection(db, "cotisations"), where("membre_id", "==", state.currentUser.uid)),
    (snap) => {
      state.cotisations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    }
  );
  const unsubCommunications = onSnapshot(
    query(collection(db, "communications"), where("coordination_id", "==", state.currentUser.coordination_id)),
    (snap) => {
      state.communications = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => !c.association_id || c.association_id === state.associationId);
      renderCommunications();
    }
  );
  state.unsubscribers.push(unsubCotisations, unsubCommunications);
}

function renderCommunications() {
  const container = document.getElementById("liste-communications");
  if (!container) return;
  if (state.communications.length === 0) {
    container.innerHTML = `<p class="empty-state">Aucun message reçu pour l'instant.</p>`;
    return;
  }
  const tri = [...state.communications].sort((a, b) => (b.date_creation?.toMillis?.() || 0) - (a.date_creation?.toMillis?.() || 0));
  container.innerHTML = tri.map((c) => `
    <div class="entity-card">
      <div class="entity-card-top">
        <div>
          <p class="entity-nom">${c.association_id ? "Message pour votre association" : "Message pour toutes les associations"}</p>
          <p class="entity-sub">${formatDate(c.date_creation)} · ${c.auteur_nom || "Coordination"}</p>
          <p style="margin-top:6px;">${c.message}</p>
        </div>
      </div>
    </div>
  `).join("");
}

function render() {
  const total = state.cotisations.reduce((s, c) => s + Number(c.montant || 0), 0);
  document.getElementById("stat-total-cotise").textContent = formatMontant(total);
  document.getElementById("stat-nb-cotisations").textContent = state.cotisations.length;

  const container = document.getElementById("liste-cotisations");
  if (state.cotisations.length === 0) {
    container.innerHTML = `<p class="empty-state">Aucune cotisation enregistrée pour l'instant.</p>`;
    return;
  }
  const libellesType = { quota: "Quota (barème)", volontaire: "Contribution volontaire", libre: "Paiement libre" };
  const tri = [...state.cotisations].sort((a, b) => (b.date?.toMillis?.() || 0) - (a.date?.toMillis?.() || 0));
  container.innerHTML = tri.map((c) => `
    <div class="entity-card">
      <div class="entity-card-top">
        <div>
          <p class="entity-nom">${libellesType[c.type] || c.type}</p>
          <p class="entity-sub">${formatDate(c.date)}</p>
        </div>
        <span class="badge badge-actif">${formatMontant(c.montant)}</span>
      </div>
    </div>
  `).join("");
}

function ouvrirModal(html) {
  document.getElementById("modal-content").innerHTML = html;
  const overlay = document.getElementById("modal-overlay");
  overlay.classList.remove("hidden");
  overlay.style.display = "flex";
}
function fermerModal() {
  const overlay = document.getElementById("modal-overlay");
  overlay.classList.add("hidden");
  overlay.style.display = "none";
  document.getElementById("modal-content").innerHTML = "";
}
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") fermerModal();
});

demarrer();
