const sb = window.supabaseClient;

const sectionMeta = {
    dashboard: ['Dashboard', 'Manage your portfolio from one place.'],
    profile: ['Profile', 'Your personal and professional information.'],
    experience: ['Experience', 'Manage your professional experience.'],
    education: ['Education', 'Manage your education history.'],
    certificates: ['Certificates', 'Manage your certifications.'],
    projects: ['Projects', 'Manage projects displayed on your portfolio.'],
    skills: ['Skills', 'Manage technical and professional skills.'],
    social: ['Social Links', 'Manage your public social and contact links.']
};

const state = {
    records: {
        experience: [],
        education: [],
        certificates: [],
        projects: [],
        skills: [],
        social: []
    }
};

const $ = (id) => document.getElementById(id);
const value = (id) => $(id).value.trim();
const checked = (id) => $(id).checked;

function escapeHtml(input = '') {
    return String(input)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function showToast(message, type = 'success') {
    const toast = $('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.className = 'toast', 3200);
}

function formatDate(date, presentText = 'Present') {
    if (!date) return presentText;
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function setSection(name) {
    document.querySelectorAll('.admin-section').forEach(section => section.classList.remove('active'));
    document.querySelector(`#section-${name}`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.section === name));
    $('pageTitle').textContent = sectionMeta[name][0];
    $('pageSubtitle').textContent = sectionMeta[name][1];
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (name === 'dashboard') loadDashboard();
    if (name === 'profile') loadProfile();
    if (name === 'experience') loadExperience();
    if (name === 'education') loadEducation();
    if (name === 'certificates') loadCertificates();
    if (name === 'projects') loadProjects();
    if (name === 'skills') loadSkills();
    if (name === 'social') loadSocial();
}

async function ensureAdmin() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }

    const { data, error } = await sb
        .from('admin_users')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

    if (error || !data) {
        await sb.auth.signOut();
        window.location.href = 'login.html';
        return null;
    }

    $('adminUserEmail').textContent = session.user.email || '';
    $('loadingScreen').classList.add('hidden');
    $('app').classList.remove('hidden');
    return session;
}

async function loadDashboard() {
    try {
        const tables = ['experience', 'education', 'certificates', 'projects', 'skills', 'social_links'];
        const results = await Promise.all(tables.map(table => sb.from(table).select('id', { count: 'exact', head: true })));
        results.forEach((result, index) => {
            if (result.error) throw result.error;
            const key = tables[index];
            const target = {
                experience: 'countExperience',
                education: 'countEducation',
                certificates: 'countCertificates',
                projects: 'countProjects',
                skills: 'countSkills',
                social_links: 'countSocial'
            }[key];
            $(target).textContent = result.count ?? 0;
        });

        const { data: profile, error: profileError } = await sb.from('profile').select('*').limit(1).maybeSingle();
        if (profileError) throw profileError;

        $('profileOverview').innerHTML = profile ? `
            <div class="overview-item"><small>Name</small><strong>${escapeHtml(profile.name)}</strong></div>
            <div class="overview-item"><small>Title</small><strong>${escapeHtml(profile.title || '—')}</strong></div>
            <div class="overview-item"><small>Email</small><strong>${escapeHtml(profile.email || '—')}</strong></div>
            <div class="overview-item"><small>Location</small><strong>${escapeHtml(profile.location || '—')}</strong></div>
        ` : '<div class="empty-state full">Profile has not been configured yet.</div>';

        const { data: totalExperience, error: experienceError } = await sb.rpc('get_total_experience');
        if (experienceError) throw experienceError;
        $('totalExperience').textContent = totalExperience || '0 Years';
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Unable to load dashboard.', 'error');
    }
}

async function loadProfile() {
    try {
        const { data, error } = await sb.from('profile').select('*').limit(1).maybeSingle();
        if (error) throw error;
        if (!data) {
            $('profileForm').reset();
            return;
        }
        $('profile_name').value = data.name || '';
        $('profile_title').value = data.title || '';
        $('profile_email').value = data.email || '';
        $('profile_phone').value = data.phone || '';
        $('profile_location').value = data.location || '';
        $('profile_about').value = data.about || '';
        $('profile_image_url').value = data.profile_image_url || '';
        $('profile_resume_url').value = data.resume_url || '';
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Unable to load profile.', 'error');
    }
}

async function saveProfile(event) {
    event.preventDefault();
    const payload = {
        profile_key: 'main',
        name: value('profile_name'),
        title: value('profile_title') || null,
        about: value('profile_about') || null,
        email: value('profile_email') || null,
        phone: value('profile_phone') || null,
        location: value('profile_location') || null,
        profile_image_url: value('profile_image_url') || null,
        resume_url: value('profile_resume_url') || null
    };

    try {
        const { error } = await sb.from('profile').upsert(payload, { onConflict: 'profile_key' });
        if (error) throw error;
        showToast('Profile saved successfully.');
        await loadDashboard();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Unable to save profile.', 'error');
    }
}

function resetForm(formId) {
    $(formId).reset();
    const hidden = $(formId).querySelector('input[type="hidden"]');
    if (hidden) hidden.value = '';
}

function showEditor(id, show = true) {
    $(id).classList.toggle('hidden', !show);
    if (show) $(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function experienceCard(item) {
    const status = item.is_current ? '<span class="badge">Current</span>' : (item.is_visible ? '<span class="badge">Visible</span>' : '<span class="badge hidden-badge">Hidden</span>');
    return `<article class="record-card">
        <div class="record-main">
            <h3>${escapeHtml(item.position)} ${status}</h3>
            <p class="meta"><strong>${escapeHtml(item.company_name)}</strong> · ${escapeHtml(item.location || 'Location not set')}<br>${formatDate(item.start_date)} – ${item.is_current ? 'Present' : formatDate(item.end_date)}</p>
            ${item.description ? `<p class="description">${escapeHtml(item.description)}</p>` : ''}
        </div>
        <div class="record-actions"><button class="small-btn" data-edit="experience" data-id="${item.id}">Edit</button><button class="small-btn delete" data-delete="experience" data-id="${item.id}">Delete</button></div>
    </article>`;
}

async function loadExperience() {
    try {
        const { data, error } = await sb.from('experience').select('*').order('start_date', { ascending: false });
        if (error) throw error;
        state.records.experience = data || [];
        $('experienceList').innerHTML = state.records.experience.length ? state.records.experience.map(experienceCard).join('') : '<div class="empty-state">No experience records yet.</div>';
    } catch (error) { showToast(error.message || 'Unable to load experience.', 'error'); }
}

function editExperience(id) {
    const item = state.records.experience.find(x => x.id === id);
    if (!item) return;
    $('experience_id').value = item.id;
    $('experience_company').value = item.company_name || '';
    $('experience_position').value = item.position || '';
    $('experience_start').value = item.start_date || '';
    $('experience_end').value = item.end_date || '';
    $('experience_current').checked = !!item.is_current;
    $('experience_location').value = item.location || '';
    $('experience_description').value = item.description || '';
    $('experience_visible').checked = item.is_visible !== false;
    showEditor('experienceEditor');
}

async function saveExperience(event) {
    event.preventDefault();
    const isCurrent = checked('experience_current');
    const payload = {
        company_name: value('experience_company'),
        position: value('experience_position'),
        start_date: value('experience_start'),
        end_date: isCurrent ? null : (value('experience_end') || null),
        is_current: isCurrent,
        description: value('experience_description') || null,
        location: value('experience_location') || null,
        is_visible: checked('experience_visible')
    };
    try {
        const id = value('experience_id');
        const query = id ? sb.from('experience').update(payload).eq('id', id) : sb.from('experience').insert(payload);
        const { error } = await query;
        if (error) throw error;
        showToast('Experience saved.');
        resetForm('experienceForm');
        showEditor('experienceEditor', false);
        await loadExperience();
        await loadDashboard();
    } catch (error) { showToast(error.message || 'Unable to save experience.', 'error'); }
}

function educationCard(item) {
    const status = item.is_visible ? '<span class="badge">Visible</span>' : '<span class="badge hidden-badge">Hidden</span>';
    return `<article class="record-card">
        <div class="record-main"><h3>${escapeHtml(item.qualification)} ${status}</h3><p class="meta">${escapeHtml(item.field || '')}${item.field ? ' · ' : ''}${escapeHtml(item.institution)}${item.university ? ' · ' + escapeHtml(item.university) : ''}<br>Passout: ${escapeHtml(item.passout_year)}</p></div>
        <div class="record-actions"><button class="small-btn" data-edit="education" data-id="${item.id}">Edit</button><button class="small-btn delete" data-delete="education" data-id="${item.id}">Delete</button></div>
    </article>`;
}

async function loadEducation() {
    try {
        const { data, error } = await sb.from('education').select('*').order('passout_year', { ascending: false });
        if (error) throw error;
        state.records.education = data || [];
        $('educationList').innerHTML = state.records.education.length ? state.records.education.map(educationCard).join('') : '<div class="empty-state">No education records yet.</div>';
    } catch (error) { showToast(error.message || 'Unable to load education.', 'error'); }
}

function editEducation(id) {
    const item = state.records.education.find(x => x.id === id);
    if (!item) return;
    $('education_id').value = item.id;
    $('education_qualification').value = item.qualification || '';
    $('education_field').value = item.field || '';
    $('education_institution').value = item.institution || '';
    $('education_university').value = item.university || '';
    $('education_year').value = item.passout_year || '';
    $('education_visible').checked = item.is_visible !== false;
    showEditor('educationEditor');
}

async function saveEducation(event) {
    event.preventDefault();
    const payload = {
        qualification: value('education_qualification'),
        field: value('education_field') || null,
        institution: value('education_institution'),
        university: value('education_university') || null,
        passout_year: Number(value('education_year')),
        is_visible: checked('education_visible')
    };
    try {
        const id = value('education_id');
        const query = id ? sb.from('education').update(payload).eq('id', id) : sb.from('education').insert(payload);
        const { error } = await query;
        if (error) throw error;
        showToast('Education saved.');
        resetForm('educationForm'); showEditor('educationEditor', false); await loadEducation(); await loadDashboard();
    } catch (error) { showToast(error.message || 'Unable to save education.', 'error'); }
}

function certificateCard(item) {
    const status = item.is_visible ? '<span class="badge">Visible</span>' : '<span class="badge hidden-badge">Hidden</span>';
    return `<article class="record-card"><div class="record-main"><h3>${escapeHtml(item.certification_name)} ${status}</h3><p class="meta">${escapeHtml(item.organization)}</p>${item.description ? `<p class="description">${escapeHtml(item.description)}</p>` : ''}</div><div class="record-actions"><button class="small-btn" data-edit="certificates" data-id="${item.id}">Edit</button><button class="small-btn delete" data-delete="certificates" data-id="${item.id}">Delete</button></div></article>`;
}

async function loadCertificates() {
    try {
        const { data, error } = await sb.from('certificates').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        state.records.certificates = data || [];
        $('certificateList').innerHTML = state.records.certificates.length ? state.records.certificates.map(certificateCard).join('') : '<div class="empty-state">No certificates yet.</div>';
    } catch (error) { showToast(error.message || 'Unable to load certificates.', 'error'); }
}

function editCertificate(id) {
    const item = state.records.certificates.find(x => x.id === id); if (!item) return;
    $('certificate_id').value = item.id; $('certificate_name').value = item.certification_name || ''; $('certificate_org').value = item.organization || ''; $('certificate_description').value = item.description || ''; $('certificate_visible').checked = item.is_visible !== false; showEditor('certificateEditor');
}

async function saveCertificate(event) {
    event.preventDefault();
    const payload = { certification_name: value('certificate_name'), organization: value('certificate_org'),  description: value('certificate_description') || null, is_visible: checked('certificate_visible') };
    try { const id = value('certificate_id'); const query = id ? sb.from('certificates').update(payload).eq('id', id) : sb.from('certificates').insert(payload); const { error } = await query; if (error) throw error; showToast('Certificate saved.'); resetForm('certificateForm'); showEditor('certificateEditor', false); await loadCertificates(); await loadDashboard(); } catch (error) { showToast(error.message || 'Unable to save certificate.', 'error'); }
}

function projectCard(item) {
    const status = item.is_visible ? '<span class="badge">Visible</span>' : '<span class="badge hidden-badge">Hidden</span>';
    return `<article class="record-card"><div class="record-main"><h3>${escapeHtml(item.title)} ${status}</h3><p class="meta">${escapeHtml(item.category || 'Uncategorized')} · ${escapeHtml(item.technologies || 'Technologies not set')}</p>${item.description ? `<p class="description">${escapeHtml(item.description)}</p>` : ''}</div><div class="record-actions"><button class="small-btn" data-edit="projects" data-id="${item.id}">Edit</button><button class="small-btn delete" data-delete="projects" data-id="${item.id}">Delete</button></div></article>`;
}

async function loadProjects() {
    try { const { data, error } = await sb.from('projects').select('*').order('created_at', { ascending: false }); if (error) throw error; state.records.projects = data || []; $('projectList').innerHTML = state.records.projects.length ? state.records.projects.map(projectCard).join('') : '<div class="empty-state">No projects yet.</div>'; } catch (error) { showToast(error.message || 'Unable to load projects.', 'error'); }
}

function editProject(id) { const item = state.records.projects.find(x => x.id === id); if (!item) return; $('project_id').value = item.id; $('project_title').value = item.title || ''; $('project_category').value = item.category || ''; $('project_description').value = item.description || ''; $('project_technologies').value = item.technologies || ''; $('project_key_details').value = item.key_details || ''; $('project_image_url').value = item.image_url || ''; $('project_visible').checked = item.is_visible !== false; showEditor('projectEditor'); }

async function saveProject(event) { event.preventDefault(); const payload = { title: value('project_title'), category: value('project_category') || null, description: value('project_description') || null, technologies: value('project_technologies') || null, key_details: value('project_key_details') || null, image_url: value('project_image_url') || null, is_visible: checked('project_visible') }; try { const id = value('project_id'); const query = id ? sb.from('projects').update(payload).eq('id', id) : sb.from('projects').insert(payload); const { error } = await query; if (error) throw error; showToast('Project saved.'); resetForm('projectForm'); showEditor('projectEditor', false); await loadProjects(); await loadDashboard(); } catch (error) { showToast(error.message || 'Unable to save project.', 'error'); } }

function skillCard(item) { const status = item.is_visible ? '<span class="badge">Visible</span>' : '<span class="badge hidden-badge">Hidden</span>'; return `<article class="record-card"><div class="record-main"><h3>${escapeHtml(item.skill_name)} ${status}</h3><p class="meta">${escapeHtml(item.category || 'Uncategorized')}</p>${item.description ? `<p class="description">${escapeHtml(item.description)}</p>` : ''}</div><div class="record-actions"><button class="small-btn" data-edit="skills" data-id="${item.id}">Edit</button><button class="small-btn delete" data-delete="skills" data-id="${item.id}">Delete</button></div></article>`; }

async function loadSkills() { try { const { data, error } = await sb.from('skills').select('*').order('created_at', { ascending: false }); if (error) throw error; state.records.skills = data || []; $('skillList').innerHTML = state.records.skills.length ? state.records.skills.map(skillCard).join('') : '<div class="empty-state">No skills yet.</div>'; } catch (error) { showToast(error.message || 'Unable to load skills.', 'error'); } }
function editSkill(id) { const item = state.records.skills.find(x => x.id === id); if (!item) return; $('skill_id').value = item.id; $('skill_name').value = item.skill_name || ''; $('skill_category').value = item.category || ''; $('skill_description').value = item.description || ''; $('skill_visible').checked = item.is_visible !== false; showEditor('skillEditor'); }
async function saveSkill(event) { event.preventDefault(); const payload = { skill_name: value('skill_name'), category: value('skill_category') || null, description: value('skill_description') || null, is_visible: checked('skill_visible') }; try { const id = value('skill_id'); const query = id ? sb.from('skills').update(payload).eq('id', id) : sb.from('skills').insert(payload); const { error } = await query; if (error) throw error; showToast('Skill saved.'); resetForm('skillForm'); showEditor('skillEditor', false); await loadSkills(); await loadDashboard(); } catch (error) { showToast(error.message || 'Unable to save skill.', 'error'); } }

function socialCard(item) { const status = item.is_visible ? '<span class="badge">Visible</span>' : '<span class="badge hidden-badge">Hidden</span>'; return `<article class="record-card"><div class="record-main"><h3>${escapeHtml(item.platform)} ${status}</h3><p class="meta">${escapeHtml(item.label || '')}<br><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" style="color:var(--accent)">${escapeHtml(item.url)}</a></p></div><div class="record-actions"><button class="small-btn" data-edit="social" data-id="${item.id}">Edit</button><button class="small-btn delete" data-delete="social_links" data-id="${item.id}">Delete</button></div></article>`; }
async function loadSocial() { try { const { data, error } = await sb.from('social_links').select('*').order('created_at', { ascending: false }); if (error) throw error; state.records.social = data || []; $('socialList').innerHTML = state.records.social.length ? state.records.social.map(socialCard).join('') : '<div class="empty-state">No social links yet.</div>'; } catch (error) { showToast(error.message || 'Unable to load social links.', 'error'); } }
function editSocial(id) { const item = state.records.social.find(x => x.id === id); if (!item) return; $('social_id').value = item.id; $('social_platform').value = item.platform || ''; $('social_label').value = item.label || ''; $('social_url').value = item.url || ''; $('social_visible').checked = item.is_visible !== false; showEditor('socialEditor'); }
async function saveSocial(event) { event.preventDefault(); const payload = { platform: value('social_platform'), label: value('social_label') || null, url: value('social_url'), is_visible: checked('social_visible') }; try { const id = value('social_id'); const query = id ? sb.from('social_links').update(payload).eq('id', id) : sb.from('social_links').insert(payload); const { error } = await query; if (error) throw error; showToast('Social link saved.'); resetForm('socialForm'); showEditor('socialEditor', false); await loadSocial(); await loadDashboard(); } catch (error) { showToast(error.message || 'Unable to save social link.', 'error'); } }

const tableMap = { experience: 'experience', education: 'education', certificates: 'certificates', projects: 'projects', skills: 'skills', social_links: 'social_links', social: 'social_links' };
const stateKeyMap = { experience: 'experience', education: 'education', certificates: 'certificates', projects: 'projects', skills: 'skills', social: 'social' };

async function deleteRecord(type, id) {
    const table = tableMap[type];
    if (!table) return;
    if (!confirm('Delete this record? This cannot be undone.')) return;
    try {
        const { error } = await sb.from(table).delete().eq('id', id);
        if (error) throw error;
        showToast('Record deleted.');
        const key = stateKeyMap[type];
        if (key) {
            const loaders = { experience: loadExperience, education: loadEducation, certificates: loadCertificates, projects: loadProjects, skills: loadSkills, social: loadSocial };
            await loaders[key]();
        }
        await loadDashboard();
    } catch (error) { showToast(error.message || 'Unable to delete record.', 'error'); }
}

document.addEventListener('click', async (event) => {
    const nav = event.target.closest('.nav-item');
    if (nav) return setSection(nav.dataset.section);

    const go = event.target.closest('[data-go]');
    if (go) return setSection(go.dataset.go);

    const cancel = event.target.closest('[data-cancel]');
    if (cancel) { resetForm(cancel.dataset.cancel.replace('Editor', 'Form')); showEditor(cancel.dataset.cancel, false); return; }

    const edit = event.target.closest('[data-edit]');
    if (edit) {
        const actions = { experience: editExperience, education: editEducation, certificates: editCertificate, projects: editProject, skills: editSkill, social: editSocial };
        return actions[edit.dataset.edit]?.(edit.dataset.id);
    }

    const del = event.target.closest('[data-delete]');
    if (del) return deleteRecord(del.dataset.delete, del.dataset.id);
});

$('newExperienceBtn').addEventListener('click', () => { resetForm('experienceForm'); $('experience_visible').checked = true; $('experience_end').disabled = false; showEditor('experienceEditor'); });
$('newEducationBtn').addEventListener('click', () => { resetForm('educationForm'); $('education_visible').checked = true; showEditor('educationEditor'); });
$('newCertificateBtn').addEventListener('click', () => { resetForm('certificateForm'); $('certificate_visible').checked = true; showEditor('certificateEditor'); });
$('newProjectBtn').addEventListener('click', () => { resetForm('projectForm'); $('project_visible').checked = true; showEditor('projectEditor'); });
$('newSkillBtn').addEventListener('click', () => { resetForm('skillForm'); $('skill_visible').checked = true; showEditor('skillEditor'); });
$('newSocialBtn').addEventListener('click', () => { resetForm('socialForm'); $('social_visible').checked = true; showEditor('socialEditor'); });

$('experience_current').addEventListener('change', () => { $('experience_end').disabled = checked('experience_current'); if (checked('experience_current')) $('experience_end').value = ''; });
$('profileForm').addEventListener('submit', saveProfile);
$('experienceForm').addEventListener('submit', saveExperience);
$('experience_current').dispatchEvent(new Event('change'));
$('educationForm').addEventListener('submit', saveEducation);
$('certificateForm').addEventListener('submit', saveCertificate);
$('projectForm').addEventListener('submit', saveProject);
$('skillForm').addEventListener('submit', saveSkill);
$('socialForm').addEventListener('submit', saveSocial);

$('logoutBtn').addEventListener('click', async () => { await sb.auth.signOut(); window.location.href = 'login.html'; });

(async function init() {
    try {
        const session = await ensureAdmin();
        if (!session) return;
        await loadDashboard();
    } catch (error) {
        console.error(error);
        window.location.href = 'login.html';
    }
})();
