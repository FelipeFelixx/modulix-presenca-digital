/* =========================================================
   MODULIX STUDIO
   Presença Digital
   Supabase + Dashboard + Clientes + Projetos + Templates
========================================================= */

(() => {
  "use strict";

  /* =======================================================
     SUPABASE
  ======================================================== */

  const { createClient } = window.supabase;

  const supabaseClient = createClient(
    window.MODULIX_SUPABASE_URL,
    window.MODULIX_SUPABASE_PUBLISHABLE_KEY
  );


  /* =======================================================
     ESTADO
  ======================================================== */

  const state = {
    user: null,
    clients: [],
    projects: [],
    templates: [],
    currentProject: null,
    currentPreview: null
  };


  /* =======================================================
     HELPERS DOM
  ======================================================== */

  const $ = (selector) => document.querySelector(selector);

  const $$ = (selector) => {
    return Array.from(document.querySelectorAll(selector));
  };


  /* =======================================================
     HELPERS
  ======================================================== */

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function normalizeText(value) {
    return String(value ?? "").trim();
  }


  function slugify(value) {
    return normalizeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }


  function firstLetter(value) {
    const text = normalizeText(value);

    return text
      ? text.charAt(0).toUpperCase()
      : "M";
  }


  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }


  function statusLabel(status) {
    const labels = {
      draft: "Rascunho",
      review: "Em revisão",
      approved: "Aprovado",
      published: "Publicado",
      archived: "Arquivado"
    };

    return labels[status] || status || "Rascunho";
  }


  function showMessage(element, message, type = "") {
    if (!element) return;

    element.textContent = message || "";

    element.className = "form-message";

    if (type) {
      element.classList.add(type);
    }
  }


  function showToast(message, type = "success") {
    const toast = $("#toast");
    const toastMessage = $("#toastMessage");
    const toastIcon = $("#toastIcon");

    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;

    if (toastIcon) {
      toastIcon.textContent = type === "error" ? "!" : "✓";
    }

    toast.classList.add("show");

    window.clearTimeout(showToast.timer);

    showToast.timer = window.setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }


  function setLoading(container, message = "Carregando") {
    if (!container) return;

    container.innerHTML = `
      <div class="loading">
        ${escapeHtml(message)}
      </div>
    `;
  }


  /* =======================================================
     VIEW / NAVEGAÇÃO
  ======================================================== */

  const viewTitles = {
    dashboard: "Dashboard",
    clients: "Clientes",
    projects: "Projetos",
    templates: "Modelos",
    editor: "Construtor",
    preview: "Preview"
  };


  function show(viewName) {
    const views = $$(".view");

    views.forEach((view) => {
      view.classList.remove("active-view");
    });

    const target = $(`#view-${viewName}`);

    if (target) {
      target.classList.add("active-view");
    }

    $$(".nav-item").forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.view === viewName
      );
    });

    const title = $("#pageTitle");

    if (title) {
      title.textContent = viewTitles[viewName] || "Studio";
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    closeMobileMenu();
  }


  function openMobileMenu() {
    $(".sidebar")?.classList.add("mobile-open");
  }


  function closeMobileMenu() {
    $(".sidebar")?.classList.remove("mobile-open");
  }


  /* =======================================================
     AUTH
  ======================================================== */

  async function getSession() {
    const {
      data,
      error
    } = await supabaseClient.auth.getSession();

    if (error) {
      console.error(error);
      return null;
    }

    return data.session;
  }


  async function login(email, password) {
    const button = $("#loginSubmit");
    const message = $("#loginMessage");

    showMessage(message, "Entrando...");

    if (button) {
      button.disabled = true;
      button.textContent = "Entrando...";
    }

    const {
      data,
      error
    } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (button) {
      button.disabled = false;
      button.textContent = "Entrar no Studio";
    }

    if (error) {
      console.error(error);

      showMessage(
        message,
        error.message || "Não foi possível entrar.",
        "error"
      );

      return;
    }

    showMessage(
      message,
      "Login realizado.",
      "success"
    );

    state.user = data.user;

    await enterApp();
  }


  async function logout() {
    const {
      error
    } = await supabaseClient.auth.signOut();

    if (error) {
      console.error(error);

      showToast(
        "Não foi possível sair.",
        "error"
      );

      return;
    }

    state.user = null;

    $("#app")?.classList.add("hidden");
    $("#loginScreen")?.classList.remove("hidden");

    const loginMessage = $("#loginMessage");

    showMessage(
      loginMessage,
      "Sessão encerrada.",
      "success"
    );
  }


  async function enterApp() {
    $("#loginScreen")?.classList.add("hidden");
    $("#app")?.classList.remove("hidden");

    updateUserInterface();

    show("dashboard");

    await loadAll();
  }


  function updateUserInterface() {
    const emailElement = $("#userEmail");

    if (emailElement) {
      emailElement.textContent =
        state.user?.email || "Usuário";
    }

    const avatar = $(".user-avatar");

    if (avatar) {
      avatar.textContent =
        firstLetter(state.user?.email || "M");
    }
  }


  /* =======================================================
     CLIENTES
  ======================================================== */

  async function loadClients() {
    const {
      data,
      error
    } = await supabaseClient
      .from("digital_presence_clients")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error("Erro ao carregar clientes:", error);

      showToast(
        "Não foi possível carregar os clientes.",
        "error"
      );

      return [];
    }

    state.clients = data || [];

    return state.clients;
  }


  async function saveClient(event) {
    event.preventDefault();

    const form = $("#clientForm");

    if (!form) return;

    const id = normalizeText(
      $("#clientId")?.value
    );

    const payload = {
      name: normalizeText($("#clientName")?.value),
      category: normalizeText($("#clientCategory")?.value),
      email: normalizeText($("#clientEmail")?.value),
      phone: normalizeText($("#clientPhone")?.value),
      whatsapp: normalizeText($("#clientWhatsapp")?.value),
      instagram: normalizeText($("#clientInstagram")?.value),
      address: normalizeText($("#clientAddress")?.value),
      hours: normalizeText($("#clientHours")?.value),
      notes: normalizeText($("#clientNotes")?.value)
    };

    if (!payload.name) {
      showMessage(
        $("#clientMessage"),
        "Informe o nome ou empresa.",
        "error"
      );

      return;
    }

    const button = form.querySelector(
      'button[type="submit"]'
    );

    if (button) {
      button.disabled = true;
      button.textContent = "Salvando...";
    }

    let result;

    if (id) {
      result = await supabaseClient
        .from("digital_presence_clients")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
    } else {
      result = await supabaseClient
        .from("digital_presence_clients")
        .insert({
          ...payload,
          created_by: state.user.id
        })
        .select()
        .single();
    }

    if (button) {
      button.disabled = false;
      button.textContent = "Salvar cliente";
    }

    if (result.error) {
      console.error(result.error);

      showMessage(
        $("#clientMessage"),
        result.error.message ||
          "Não foi possível salvar o cliente.",
        "error"
      );

      return;
    }

    await loadClients();
    renderClients();
    populateClientSelect();
    updateMetrics();

    resetClientForm();

    showMessage(
      $("#clientMessage"),
      "Cliente salvo com sucesso.",
      "success"
    );

    showToast(
      id
        ? "Cliente atualizado."
        : "Cliente cadastrado."
    );
  }


  function editClient(id) {
    const client = state.clients.find(
      (item) => item.id === id
    );

    if (!client) return;

    $("#clientId").value = client.id || "";
    $("#clientName").value = client.name || "";
    $("#clientCategory").value = client.category || "";
    $("#clientEmail").value = client.email || "";
    $("#clientPhone").value = client.phone || "";
    $("#clientWhatsapp").value = client.whatsapp || "";
    $("#clientInstagram").value = client.instagram || "";
    $("#clientAddress").value = client.address || "";
    $("#clientHours").value = client.hours || "";
    $("#clientNotes").value = client.notes || "";

    const title = $("#clientFormTitle");

    if (title) {
      title.textContent = "Editar cliente";
    }

    show("clients");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }


  function resetClientForm() {
    const form = $("#clientForm");

    if (form) {
      form.reset();
    }

    if ($("#clientId")) {
      $("#clientId").value = "";
    }

    if ($("#clientFormTitle")) {
      $("#clientFormTitle").textContent =
        "Novo cliente";
    }

    showMessage(
      $("#clientMessage"),
      ""
    );
  }


  async function archiveClient(id) {
    const client = state.clients.find(
      (item) => item.id === id
    );

    if (!client) return;

    const confirmed = window.confirm(
      `Arquivar o cliente "${client.name}"?`
    );

    if (!confirmed) return;

    const {
      error
    } = await supabaseClient
      .from("digital_presence_clients")
      .update({
        status: "archived"
      })
      .eq("id", id);

    if (error) {
      console.error(error);

      showToast(
        "Não foi possível arquivar o cliente.",
        "error"
      );

      return;
    }

    await loadClients();

    renderClients();
    populateClientSelect();
    updateMetrics();

    showToast(
      "Cliente arquivado."
    );
  }


  /* =======================================================
     PROJETOS
  ======================================================== */

  async function loadProjects() {
    const {
      data,
      error
    } = await supabaseClient
      .from("digital_presence_projects")
      .select(`
        *,
        client:digital_presence_clients (
          id,
          name,
          category
        ),
        template:digital_presence_templates (
          id,
          slug,
          name,
          version
        )
      `)
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error("Erro ao carregar projetos:", error);

      showToast(
        "Não foi possível carregar os projetos.",
        "error"
      );

      return [];
    }

    state.projects = data || [];

    return state.projects;
  }


  async function saveProject(event) {
    event.preventDefault();

    const form = $("#projectForm");

    if (!form) return;

    const id = normalizeText(
      $("#projectId")?.value
    );

    const clientId = normalizeText(
      $("#projectClient")?.value
    );

    const templateId = normalizeText(
      $("#projectTemplate")?.value
    );

    const name = normalizeText(
      $("#projectName")?.value
    );

    if (!name || !clientId || !templateId) {
      showMessage(
        $("#projectMessage"),
        "Preencha nome, cliente e modelo.",
        "error"
      );

      return;
    }

    const client = state.clients.find(
      (item) => item.id === clientId
    );

    const template = state.templates.find(
      (item) => item.id === templateId
    );

    if (!client || !template) {
      showMessage(
        $("#projectMessage"),
        "Cliente ou modelo inválido.",
        "error"
      );

      return;
    }

    let slug = normalizeText(
      $("#projectSlug")?.value
    );

    if (!slug) {
      slug = slugify(name);
    } else {
      slug = slugify(slug);
    }

    const content = {
      headline: normalizeText(
        $("#projectHeadline")?.value
      ),

      description: normalizeText(
        $("#projectDescription")?.value
      ),

      cta: normalizeText(
        $("#projectCta")?.value
      ),

      client: {
        name: client.name || "",
        category: client.category || "",
        email: client.email || "",
        phone: client.phone || "",
        whatsapp: client.whatsapp || "",
        instagram: client.instagram || "",
        address: client.address || "",
        hours: client.hours || "",
        notes: client.notes || ""
      }
    };

    const payload = {
      client_id: clientId,
      template_id: templateId,
      name,
      slug,
      status:
        normalizeText(
          $("#projectStatus")?.value
        ) || "draft",
      content
    };

    const button = form.querySelector(
      'button[type="submit"]'
    );

    if (button) {
      button.disabled = true;
      button.textContent = "Salvando...";
    }

    let result;

    if (id) {
      result = await supabaseClient
        .from("digital_presence_projects")
        .update(payload)
        .eq("id", id)
        .select(`
          *,
          client:digital_presence_clients (
            id,
            name,
            category
          ),
          template:digital_presence_templates (
            id,
            slug,
            name,
            version
          )
        `)
        .single();
    } else {
      result = await supabaseClient
        .from("digital_presence_projects")
        .insert({
          ...payload,
          created_by: state.user.id
        })
        .select(`
          *,
          client:digital_presence_clients (
            id,
            name,
            category
          ),
          template:digital_presence_templates (
            id,
            slug,
            name,
            version
          )
        `)
        .single();
    }

    if (button) {
      button.disabled = false;
      button.textContent = "Salvar projeto";
    }

    if (result.error) {
      console.error(result.error);

      let message =
        result.error.message ||
        "Não foi possível salvar o projeto.";

      if (
        result.error.code === "23505" &&
        result.error.message?.includes("slug")
      ) {
        message =
          "Esse slug já está sendo usado. Escolha outro.";
      }

      showMessage(
        $("#projectMessage"),
        message,
        "error"
      );

      return;
    }

    state.currentProject = result.data;

    await loadProjects();

    renderProjects();
    renderDashboardProjects();
    updateMetrics();

    showMessage(
      $("#projectMessage"),
      "Projeto salvo com sucesso.",
      "success"
    );

    showToast(
      id
        ? "Projeto atualizado."
        : "Projeto criado."
    );
  }


  function newProject(clientId = "") {
    state.currentProject = null;

    const form = $("#projectForm");

    if (form) {
      form.reset();
    }

    $("#projectId").value = "";

    $("#formTitle").textContent =
      "Novo projeto";

    $("#projectStatus").value =
      "draft";

    populateClientSelect(clientId);

    populateTemplateSelect();

    renderTemplateChoices();

    showMessage(
      $("#projectMessage"),
      ""
    );

    show("editor");
  }


  function editProject(id) {
    const project = state.projects.find(
      (item) => item.id === id
    );

    if (!project) return;

    state.currentProject = project;

    $("#projectId").value =
      project.id || "";

    $("#projectName").value =
      project.name || "";

    populateClientSelect(
      project.client_id || ""
    );

    populateTemplateSelect(
      project.template_id || ""
    );

    $("#projectSlug").value =
      project.slug || "";

    $("#projectStatus").value =
      project.status || "draft";

    const content =
      project.content || {};

    $("#projectHeadline").value =
      content.headline || "";

    $("#projectDescription").value =
      content.description || "";

    $("#projectCta").value =
      content.cta || "";

    $("#formTitle").textContent =
      "Editar projeto";

    showMessage(
      $("#projectMessage"),
      ""
    );

    renderTemplateChoices(
      project.template_id || ""
    );

    show("editor");
  }


  async function archiveProject(id) {
    const project = state.projects.find(
      (item) => item.id === id
    );

    if (!project) return;

    const confirmed = window.confirm(
      `Arquivar o projeto "${project.name}"?`
    );

    if (!confirmed) return;

    const {
      error
    } = await supabaseClient
      .from("digital_presence_projects")
      .update({
        status: "archived"
      })
      .eq("id", id);

    if (error) {
      console.error(error);

      showToast(
        "Não foi possível arquivar o projeto.",
        "error"
      );

      return;
    }

    await loadProjects();

    renderProjects();
    renderDashboardProjects();
    updateMetrics();

    showToast(
      "Projeto arquivado."
    );
  }


  /* =======================================================
     TEMPLATES
  ======================================================== */

  async function loadTemplates() {
    const {
      data,
      error
    } = await supabaseClient
      .from("digital_presence_templates")
      .select("*")
      .eq("active", true)
      .order("name", {
        ascending: true
      });

    if (error) {
      console.error("Erro ao carregar modelos:", error);

      showToast(
        "Não foi possível carregar os modelos.",
        "error"
      );

      return [];
    }

    state.templates = data || [];

    return state.templates;
  }


  function populateClientSelect(selectedId = "") {
    const select = $("#projectClient");

    if (!select) return;

    const options = [
      `
        <option value="">
          Selecione um cliente
        </option>
      `
    ];

    state.clients
      .filter(
        (client) =>
          client.status !== "archived"
      )
      .forEach((client) => {
        options.push(`
          <option
            value="${escapeHtml(client.id)}"
            ${
              client.id === selectedId
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(client.name)}
          </option>
        `);
      });

    select.innerHTML = options.join("");
  }


  function populateTemplateSelect(selectedId = "") {
    const select = $("#projectTemplate");

    if (!select) return;

    const options = [
      `
        <option value="">
          Selecione um modelo
        </option>
      `
    ];

    state.templates.forEach((template) => {
      options.push(`
        <option
          value="${escapeHtml(template.id)}"
          ${
            template.id === selectedId
              ? "selected"
              : ""
          }
        >
          ${escapeHtml(template.name)}
        </option>
      `);
    });

    select.innerHTML = options.join("");
  }


  function renderTemplateChoices(selectedId = "") {
    const container = $("#templateChoices");

    if (!container) return;

    if (!state.templates.length) {
      container.innerHTML = `
        <div class="empty-state small">
          <span>◈</span>
          <strong>Nenhum modelo disponível</strong>
          <p>Não existem modelos ativos.</p>
        </div>
      `;

      return;
    }

    container.innerHTML =
      state.templates
        .map((template) => {
          const slugClass =
            template.slug === "clean"
              ? "clean"
              : "premium";

          return `
            <button
              type="button"
              class="template-choice ${
                template.id === selectedId
                  ? "selected"
                  : ""
              }"
              data-template-id="${escapeHtml(
                template.id
              )}"
            >

              <span
                class="template-choice-preview ${slugClass}"
              ></span>

              <span class="template-choice-text">

                <strong>
                  ${escapeHtml(template.name)}
                </strong>

                <small>
                  v${escapeHtml(
                    template.version || "1.0"
                  )}
                </small>

              </span>

            </button>
          `;
        })
        .join("");
  }


  /* =======================================================
     RENDER CLIENTES
  ======================================================== */

  function renderClients() {
    const container = $("#clientList");

    if (!container) return;

    if (!state.clients.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span>♙</span>
          <strong>Nenhum cliente cadastrado</strong>
          <p>
            Use o formulário ao lado para adicionar
            um cliente.
          </p>
        </div>
      `;

      renderDashboardClients();

      return;
    }

    container.innerHTML =
      state.clients
        .map((client) => {
          const archived =
            client.status === "archived";

          return `
            <div class="client-item">

              <div class="item-main">

                <div class="item-avatar">
                  ${escapeHtml(
                    firstLetter(client.name)
                  )}
                </div>

                <div class="item-text">

                  <strong>
                    ${escapeHtml(
                      client.name
                    )}
                  </strong>

                  <small>
                    ${
                      escapeHtml(
                        client.category ||
                        client.email ||
                        "Cliente"
                      )
                    }
                  </small>

                </div>

              </div>

              <div class="item-actions">

                ${
                  archived
                    ? `
                      <span class="project-status archived">
                        Arquivado
                      </span>
                    `
                    : `
                      <button
                        type="button"
                        class="icon-btn"
                        title="Novo projeto"
                        data-action="new-project"
                        data-client-id="${escapeHtml(
                          client.id
                        )}"
                      >
                        +
                      </button>

                      <button
                        type="button"
                        class="icon-btn"
                        title="Editar"
                        data-action="edit-client"
                        data-id="${escapeHtml(
                          client.id
                        )}"
                      >
                        ✎
                      </button>

                      <button
                        type="button"
                        class="icon-btn"
                        title="Arquivar"
                        data-action="archive-client"
                        data-id="${escapeHtml(
                          client.id
                        )}"
                      >
                        ×
                      </button>
                    `
                }

              </div>

            </div>
          `;
        })
        .join("");

    renderDashboardClients();
  }


  function renderDashboardClients() {
    const container = $("#dashboardClients");

    if (!container) return;

    const clients =
      state.clients
        .filter(
          (client) =>
            client.status !== "archived"
        )
        .slice(0, 5);

    if (!clients.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span>♙</span>
          <strong>Nenhum cliente cadastrado</strong>
          <p>
            Cadastre o primeiro cliente para começar.
          </p>
        </div>
      `;

      return;
    }

    container.innerHTML =
      clients
        .map(
          (client) => `
            <div class="client-item">

              <div class="item-main">

                <div class="item-avatar">
                  ${escapeHtml(
                    firstLetter(client.name)
                  )}
                </div>

                <div class="item-text">

                  <strong>
                    ${escapeHtml(
                      client.name
                    )}
                  </strong>

                  <small>
                    ${
                      escapeHtml(
                        client.category ||
                        "Cliente"
                      )
                    }
                  </small>

                </div>

              </div>

              <button
                type="button"
                class="icon-btn"
                title="Editar cliente"
                data-action="edit-client"
                data-id="${escapeHtml(
                  client.id
                )}"
              >
                →
              </button>

            </div>
          `
        )
        .join("");
  }


  /* =======================================================
     RENDER PROJETOS
  ======================================================== */

  function renderProjects() {
    const container = $("#projectList");

    if (!container) return;

    if (!state.projects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span>▣</span>
          <strong>Nenhum projeto criado</strong>
          <p>
            Crie um projeto para começar a gerar páginas.
          </p>
        </div>
      `;

      return;
    }

    container.innerHTML =
      state.projects
        .map((project) => {
          const clientName =
            project.client?.name ||
            "Cliente";

          const templateName =
            project.template?.name ||
            "Modelo";

          return `
            <div class="project-item">

              <div class="item-main">

                <div class="item-avatar">
                  ${escapeHtml(
                    firstLetter(
                      project.name
                    )
                  )}
                </div>

                <div class="item-text">

                  <strong>
                    ${escapeHtml(
                      project.name
                    )}
                  </strong>

                  <small>
                    ${escapeHtml(
                      clientName
                    )}
                    ·
                    ${escapeHtml(
                      templateName
                    )}
                    ·
                    ${escapeHtml(
                      formatDate(
                        project.created_at
                      )
                    )}
                  </small>

                </div>

              </div>

              <div class="item-actions">

                <span
                  class="project-status ${
                    escapeHtml(
                      project.status ||
                      "draft"
                    )
                  }"
                >
                  ${escapeHtml(
                    statusLabel(
                      project.status
                    )
                  )}
                </span>

                <button
                  type="button"
                  class="icon-btn"
                  title="Editar projeto"
                  data-action="edit-project"
                  data-id="${escapeHtml(
                    project.id
                  )}"
                >
                  ✎
                </button>

                <button
                  type="button"
                  class="icon-btn"
                  title="Visualizar"
                  data-action="preview-project"
                  data-id="${escapeHtml(
                    project.id
                  )}"
                >
                  ◉
                </button>

                <button
                  type="button"
                  class="icon-btn"
                  title="Arquivar"
                  data-action="archive-project"
                  data-id="${escapeHtml(
                    project.id
                  )}"
                >
                  ×
                </button>

              </div>

            </div>
          `;
        })
        .join("");
  }


  function renderDashboardProjects() {
    const container = $("#dashboardProjects");

    if (!container) return;

    const projects =
      state.projects.slice(0, 5);

    if (!projects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span>▣</span>
          <strong>Nenhum projeto criado</strong>
          <p>
            Crie um projeto a partir de um cliente.
          </p>
        </div>
      `;

      return;
    }

    container.innerHTML =
      projects
        .map(
          (project) => `
            <div class="project-item">

              <div class="item-main">

                <div class="item-avatar">
                  ${escapeHtml(
                    firstLetter(
                      project.name
                    )
                  )}
                </div>

                <div class="item-text">

                  <strong>
                    ${escapeHtml(
                      project.name
                    )}
                  </strong>

                  <small>
                    ${escapeHtml(
                      project.client?.name ||
                      "Cliente"
                    )}
                  </small>

                </div>

              </div>

              <button
                type="button"
                class="icon-btn"
                title="Visualizar projeto"
                data-action="preview-project"
                data-id="${escapeHtml(
                  project.id
                )}"
              >
                →
              </button>

            </div>
          `
        )
        .join("");
  }


  /* =======================================================
     RENDER TEMPLATES
  ======================================================== */

  function renderTemplates() {
    const container = $("#templateList");

    if (!container) return;

    if (!state.templates.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span>◈</span>
          <strong>Nenhum modelo disponível</strong>
          <p>
            Não existem modelos ativos no momento.
          </p>
        </div>
      `;

      return;
    }

    container.innerHTML =
      state.templates
        .map((template) => {
          const slugClass =
            template.slug === "clean"
              ? "clean"
              : "premium";

          return `
            <article class="template-card">

              <div
                class="template-preview ${slugClass}"
              >

                <div
                  class="preview-decoration"
                ></div>

              </div>

              <div class="template-info">

                <h3>
                  ${escapeHtml(
                    template.name
                  )}
                </h3>

                <p>
                  ${escapeHtml(
                    template.description ||
                    "Modelo para presença digital."
                  )}
                </p>

                <div class="template-meta">

                  <span>
                    ${template.active
                      ? "Ativo"
                      : "Inativo"}
                  </span>

                  <span class="template-version">
                    v${escapeHtml(
                      template.version ||
                      "1.0"
                    )}
                  </span>

                </div>

              </div>

            </article>
          `;
        })
        .join("");
  }


  /* =======================================================
     MÉTRICAS
  ======================================================== */

  function updateMetrics() {
    const activeClients =
      state.clients.filter(
        (client) =>
          client.status !== "archived"
      );

    const publishedProjects =
      state.projects.filter(
        (project) =>
          project.status === "published"
      );

    if ($("#clientCount")) {
      $("#clientCount").textContent =
        activeClients.length;
    }

    if ($("#metricClients")) {
      $("#metricClients").textContent =
        activeClients.length;
    }

    if ($("#projectCount")) {
      $("#projectCount").textContent =
        state.projects.length;
    }

    if ($("#metricProjects")) {
      $("#metricProjects").textContent =
        state.projects.length;
    }

    if ($("#metricPublished")) {
      $("#metricPublished").textContent =
        publishedProjects.length;
    }

    if ($("#templateCount")) {
      $("#templateCount").textContent =
        state.templates.length;
    }
  }


  /* =======================================================
     PREVIEW
  ======================================================== */

  function getProjectPreviewData(project) {
    const content =
      project.content || {};

    const client =
      content.client ||
      project.client ||
      {};

    const headline =
      content.headline ||
      `Conheça ${client.name || project.name}`;

    const description =
      content.description ||
      client.notes ||
      `Uma presença digital criada pela Modulix para ${client.name || project.name}.`;

    const cta =
      content.cta ||
      "Falar pelo WhatsApp";

    return {
      project,
      client,
      headline,
      description,
      cta
    };
  }


  function whatsappUrl(phone) {
    const digits =
      String(phone || "")
        .replace(/\D/g, "");

    if (!digits) return "";

    let normalized = digits;

    if (
      normalized.length >= 10 &&
      normalized.length <= 11
    ) {
      normalized =
        `55${normalized}`;
    }

    return `https://wa.me/${normalized}`;
  }


  function safeInstagramUrl(value) {
    const text =
      normalizeText(value);

    if (!text) return "";

    if (
      /^https:\/\/(www\.)?instagram\.com\//i
        .test(text)
    ) {
      return text;
    }

    return "";
  }


  function buildPremiumPage(data) {
    const project =
      data.project;

    const client =
      data.client;

    const headline =
      data.headline;

    const description =
      data.description;

    const cta =
      data.cta;

    const whatsapp =
      whatsappUrl(
        client.whatsapp ||
        client.phone
      );

    const instagram =
      safeInstagramUrl(
        client.instagram
      );

    return `
<!DOCTYPE html>
<html lang="pt-BR">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <meta
    name="description"
    content="${escapeHtml(
      description
    )}"
  >

  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none';"
  >

  <title>
    ${escapeHtml(
      client.name ||
      project.name
    )}
  </title>

  <style>

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;

      font-family:
        Inter,
        Arial,
        sans-serif;

      background:
        radial-gradient(
          circle at 80% 10%,
          rgba(214,173,85,.16),
          transparent 28%
        ),
        #080808;

      color: #f5f5f5;

      min-height: 100vh;
    }

    .page {
      width: min(
        1120px,
        calc(100% - 40px)
      );

      margin: 0 auto;
    }

    header {
      padding: 26px 0;
    }

    nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .brand {
      font-weight: 800;
      letter-spacing: .16em;
      font-size: 13px;
    }

    .brand span {
      color: #d6ad55;
    }

    .hero {
      min-height: 78vh;

      display: flex;
      align-items: center;

      padding:
        80px 0
        110px;
    }

    .eyebrow {
      color: #d6ad55;

      font-size: 11px;
      font-weight: 800;

      letter-spacing: .16em;
      text-transform: uppercase;
    }

    h1 {
      max-width: 850px;

      margin: 18px 0;

      font-size:
        clamp(
          42px,
          7vw,
          84px
        );

      line-height: .98;

      letter-spacing: -.055em;
    }

    .description {
      max-width: 650px;

      color: #b9b9b9;

      font-size: 17px;
      line-height: 1.75;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;

      gap: 12px;

      margin-top: 32px;
    }

    .btn {
      display: inline-flex;

      align-items: center;
      justify-content: center;

      min-height: 48px;

      padding:
        0 20px;

      border-radius: 10px;

      text-decoration: none;

      font-size: 13px;
      font-weight: 800;
    }

    .btn-primary {
      background:
        linear-gradient(
          135deg,
          #f0d28a,
          #d6ad55
        );

      color: #101010;
    }

    .btn-secondary {
      border:
        1px solid
        rgba(255,255,255,.12);

      color: #ddd;

      background:
        rgba(255,255,255,.03);
    }

    section.info {
      padding: 70px 0;

      border-top:
        1px solid
        rgba(255,255,255,.08);
    }

    .grid {
      display: grid;

      grid-template-columns:
        repeat(
          3,
          minmax(0, 1fr)
        );

      gap: 16px;
    }

    .card {
      padding: 24px;

      border:
        1px solid
        rgba(255,255,255,.08);

      border-radius: 16px;

      background:
        rgba(255,255,255,.025);
    }

    .card strong {
      display: block;

      margin-bottom: 8px;

      font-size: 14px;
    }

    .card p {
      margin: 0;

      color: #8f8f8f;

      font-size: 12px;
      line-height: 1.65;
    }

    footer {
      padding: 35px 0 50px;

      border-top:
        1px solid
        rgba(255,255,255,.08);

      color: #666;

      font-size: 11px;
    }

    @media (max-width: 700px) {

      .page {
        width:
          min(
            100% - 28px,
            1120px
          );
      }

      .hero {
        min-height: 72vh;

        padding:
          55px 0
          80px;
      }

      h1 {
        font-size: 46px;
      }

      .description {
        font-size: 15px;
      }

      .grid {
        grid-template-columns: 1fr;
      }

    }

  </style>

</head>

<body>

  <header>

    <div class="page">

      <nav>

        <div class="brand">
          ${escapeHtml(
            client.name ||
            project.name
          )}
          <span>•</span>
        </div>

        <div class="eyebrow">
          Presença Digital
        </div>

      </nav>

    </div>

  </header>


  <main>

    <section class="hero">

      <div class="page">

        <div class="eyebrow">
          ${escapeHtml(
            client.category ||
            "Negócio"
          )}
        </div>

        <h1>
          ${escapeHtml(
            headline
          )}
        </h1>

        <p class="description">
          ${escapeHtml(
            description
          )}
        </p>

        <div class="actions">

          ${
            whatsapp
              ? `
                <a
                  class="btn btn-primary"
                  href="${escapeHtml(
                    whatsapp
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ${escapeHtml(
                    cta
                  )}
                </a>
              `
              : ""
          }

          ${
            instagram
              ? `
                <a
                  class="btn btn-secondary"
                  href="${escapeHtml(
                    instagram
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram
                </a>
              `
              : ""
          }

        </div>

      </div>

    </section>


    <section class="info">

      <div class="page">

        <div class="grid">

          <article class="card">

            <strong>
              Contato
            </strong>

            <p>
              ${escapeHtml(
                client.phone ||
                client.email ||
                "Entre em contato para mais informações."
              )}
            </p>

          </article>


          <article class="card">

            <strong>
              Localização
            </strong>

            <p>
              ${escapeHtml(
                client.address ||
                "Atendimento e informações disponíveis pelo contato."
              )}
            </p>

          </article>


          <article class="card">

            <strong>
              Horários
            </strong>

            <p>
              ${escapeHtml(
                client.hours ||
                "Consulte os horários de atendimento."
              )}
            </p>

          </article>

        </div>

      </div>

    </section>

  </main>


  <footer>

    <div class="page">

      Presença digital criada com
      Modulix Tecnologia.

    </div>

  </footer>

</body>

</html>
    `;
  }


  function buildCleanPage(data) {
    const project =
      data.project;

    const client =
      data.client;

    const headline =
      data.headline;

    const description =
      data.description;

    const cta =
      data.cta;

    const whatsapp =
      whatsappUrl(
        client.whatsapp ||
        client.phone
      );

    const instagram =
      safeInstagramUrl(
        client.instagram
      );

    return `
<!DOCTYPE html>
<html lang="pt-BR">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <meta
    name="description"
    content="${escapeHtml(
      description
    )}"
  >

  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none';"
  >

  <title>
    ${escapeHtml(
      client.name ||
      project.name
    )}
  </title>

  <style>

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;

      font-family:
        Inter,
        Arial,
        sans-serif;

      background: #f6f6f4;

      color: #171717;
    }

    .page {
      width:
        min(
          1080px,
          calc(100% - 36px)
        );

      margin:
        0 auto;
    }

    header {
      padding: 28px 0;
    }

    .brand {
      font-weight: 800;

      font-size: 14px;

      letter-spacing: .06em;
    }

    .hero {
      padding:
        100px 0
        120px;
    }

    .category {
      color: #777;

      font-size: 11px;

      font-weight: 800;

      letter-spacing: .13em;

      text-transform: uppercase;
    }

    h1 {
      max-width: 780px;

      margin:
        16px 0
        22px;

      font-size:
        clamp(
          42px,
          7vw,
          78px
        );

      line-height: 1;

      letter-spacing: -.055em;
    }

    .description {
      max-width: 650px;

      color: #666;

      font-size: 17px;

      line-height: 1.75;
    }

    .actions {
      display: flex;

      flex-wrap: wrap;

      gap: 10px;

      margin-top: 30px;
    }

    a {
      display: inline-flex;

      min-height: 46px;

      align-items: center;
      justify-content: center;

      padding: 0 19px;

      border-radius: 9px;

      text-decoration: none;

      font-size: 12px;

      font-weight: 800;
    }

    .primary {
      background: #171717;

      color: #fff;
    }

    .secondary {
      border:
        1px solid
        #ddd;

      color: #333;
    }

    .grid {
      display: grid;

      grid-template-columns:
        repeat(
          3,
          minmax(0, 1fr)
        );

      gap: 14px;

      padding-bottom: 80px;
    }

    .card {
      padding: 22px;

      border:
        1px solid
        #e2e2df;

      border-radius: 14px;

      background: #fff;
    }

    .card strong {
      display: block;

      margin-bottom: 7px;

      font-size: 13px;
    }

    .card p {
      margin: 0;

      color: #777;

      font-size: 11px;

      line-height: 1.6;
    }

    footer {
      padding:
        30px 0
        45px;

      border-top:
        1px solid
        #e2e2df;

      color: #888;

      font-size: 10px;
    }

    @media (max-width: 700px) {

      h1 {
        font-size: 45px;
      }

      .hero {
        padding:
          70px 0
          80px;
      }

      .grid {
        grid-template-columns: 1fr;
      }

    }

  </style>

</head>

<body>

  <header>

    <div class="page">

      <div class="brand">
        ${escapeHtml(
          client.name ||
          project.name
        )}
      </div>

    </div>

  </header>


  <main>

    <section class="hero">

      <div class="page">

        <div class="category">
          ${escapeHtml(
            client.category ||
            "Negócio"
          )}
        </div>

        <h1>
          ${escapeHtml(
            headline
          )}
        </h1>

        <p class="description">
          ${escapeHtml(
            description
          )}
        </p>

        <div class="actions">

          ${
            whatsapp
              ? `
                <a
                  class="primary"
                  href="${escapeHtml(
                    whatsapp
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ${escapeHtml(
                    cta
                  )}
                </a>
              `
              : ""
          }

          ${
            instagram
              ? `
                <a
                  class="secondary"
                  href="${escapeHtml(
                    instagram
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram
                </a>
              `
              : ""
          }

        </div>

      </div>

    </section>


    <section>

      <div class="page">

        <div class="grid">

          <article class="card">

            <strong>
              Contato
            </strong>

            <p>
              ${escapeHtml(
                client.phone ||
                client.email ||
                "Consulte o contato."
              )}
            </p>

          </article>


          <article class="card">

            <strong>
              Endereço
            </strong>

            <p>
              ${escapeHtml(
                client.address ||
                "Consulte a localização."
              )}
            </p>

          </article>


          <article class="card">

            <strong>
              Horários
            </strong>

            <p>
              ${escapeHtml(
                client.hours ||
                "Consulte os horários."
              )}
            </p>

          </article>

        </div>

      </div>

    </section>

  </main>


  <footer>

    <div class="page">

      Presença digital criada com
      Modulix Tecnologia.

    </div>

  </footer>

</body>

</html>
    `;
  }


  function buildPreviewHtml(project) {
    const data =
      getProjectPreviewData(
        project
      );

    const slug =
      project.template?.slug ||
      state.templates.find(
        (template) =>
          template.id ===
          project.template_id
      )?.slug ||
      "premium";

    if (slug === "clean") {
      return buildCleanPage(data);
    }

    return buildPremiumPage(data);
  }


  function previewProject(id) {
    const project = state.projects.find(
      (item) => item.id === id
    );

    if (!project) {
      showToast(
        "Projeto não encontrado.",
        "error"
      );

      return;
    }

    state.currentPreview = project;

    const title =
      $("#previewProjectTitle");

    if (title) {
      title.textContent =
        project.name || "Pré-visualização";
    }

    const frame =
      $("#frame");

    if (!frame) return;

    frame.srcdoc =
      buildPreviewHtml(project);

    show("preview");
  }


  function previewCurrentProject() {
    const id =
      normalizeText(
        $("#projectId")?.value
      );

    if (id) {
      previewProject(id);
      return;
    }

    const formData = {
      id: "preview",
      name:
        normalizeText(
          $("#projectName")?.value
        ) ||
        "Pré-visualização",

      template_id:
        normalizeText(
          $("#projectTemplate")?.value
        ),

      template:
        state.templates.find(
          (template) =>
            template.id ===
            normalizeText(
              $("#projectTemplate")?.value
            )
        ),

      client:
        state.clients.find(
          (client) =>
            client.id ===
            normalizeText(
              $("#projectClient")?.value
            )
        ),

      content: {
        headline:
          normalizeText(
            $("#projectHeadline")?.value
          ),

        description:
          normalizeText(
            $("#projectDescription")?.value
          ),

        cta:
          normalizeText(
            $("#projectCta")?.value
          )
      }
    };

    if (!formData.client) {
      showToast(
        "Selecione um cliente antes de visualizar.",
        "error"
      );

      return;
    }

    if (!formData.template) {
      showToast(
        "Selecione um modelo antes de visualizar.",
        "error"
      );

      return;
    }

    state.currentPreview =
      formData;

    const title =
      $("#previewProjectTitle");

    if (title) {
      title.textContent =
        formData.name;
    }

    const frame =
      $("#frame");

    if (frame) {
      frame.srcdoc =
        buildPreviewHtml(
          formData
        );
    }

    show("preview");
  }


  function downloadCurrentProject() {
    const project =
      state.currentPreview;

    if (!project) {
      showToast(
        "Nenhum projeto em preview.",
        "error"
      );

      return;
    }

    const html =
      buildPreviewHtml(
        project
      );

    const blob =
      new Blob(
        [html],
        {
          type: "text/html;charset=utf-8"
        }
      );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;

    anchor.download =
      `${slugify(
        project.slug ||
        project.name ||
        "presenca-digital"
      )}.html`;

    document.body.appendChild(anchor);

    anchor.click();

    anchor.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    showToast(
      "HTML gerado com sucesso."
    );
  }


  /* =======================================================
     LOAD GERAL
  ======================================================== */

  async function loadAll() {
    const clientsContainer =
      $("#clientList");

    const projectsContainer =
      $("#projectList");

    if (clientsContainer) {
      setLoading(
        clientsContainer,
        "Carregando clientes"
      );
    }

    if (projectsContainer) {
      setLoading(
        projectsContainer,
        "Carregando projetos"
      );
    }

    await Promise.all([
      loadClients(),
      loadProjects(),
      loadTemplates()
    ]);

    renderClients();
    renderProjects();
    renderDashboardClients();
    renderDashboardProjects();
    renderTemplates();

    populateClientSelect();
    populateTemplateSelect();

    renderTemplateChoices();

    updateMetrics();
  }


  /* =======================================================
     EVENTOS
  ======================================================== */

  function bindEvents() {

    /* Login */

    $("#loginForm")?.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const email =
          normalizeText(
            $("#loginEmail")?.value
          );

        const password =
          $("#loginPassword")?.value || "";

        if (!email || !password) {
          showMessage(
            $("#loginMessage"),
            "Informe e-mail e senha.",
            "error"
          );

          return;
        }

        await login(
          email,
          password
        );
      }
    );


    /* Logout */

    $("#logoutBtn")?.addEventListener(
      "click",
      logout
    );


    /* Navegação */

    document.addEventListener(
      "click",
      async (event) => {

        const element =
          event.target.closest(
            "[data-view], [data-action]"
          );

        if (!element) return;

        const view =
          element.dataset.view;

        const action =
          element.dataset.action;


        if (
          view &&
          !action
        ) {
          event.preventDefault();

          show(view);

          return;
        }


        if (
          action === "new-client"
        ) {
          event.preventDefault();

          resetClientForm();

          show("clients");

          return;
        }


        if (
          action === "new-project"
        ) {
          event.preventDefault();

          newProject(
            element.dataset.clientId ||
            ""
          );

          return;
        }


        if (
          action === "edit-client"
        ) {
          event.preventDefault();

          editClient(
            element.dataset.id
          );

          return;
        }


        if (
          action === "archive-client"
        ) {
          event.preventDefault();

          await archiveClient(
            element.dataset.id
          );

          return;
        }


        if (
          action === "edit-project"
        ) {
          event.preventDefault();

          editProject(
            element.dataset.id
          );

          return;
        }


        if (
          action === "archive-project"
        ) {
          event.preventDefault();

          await archiveProject(
            element.dataset.id
          );

          return;
        }


        if (
          action === "preview-project"
        ) {
          event.preventDefault();

          previewProject(
            element.dataset.id
          );

          return;
        }


        if (
          action === "close-preview"
        ) {
          event.preventDefault();

          show("projects");

          return;
        }

      }
    );


    /* Form cliente */

    $("#clientForm")?.addEventListener(
      "submit",
      saveClient
    );


    $("#cancelClientBtn")?.addEventListener(
      "click",
      resetClientForm
    );


    /* Form projeto */

    $("#projectForm")?.addEventListener(
      "submit",
      saveProject
    );


    $("#previewBtn")?.addEventListener(
      "click",
      previewCurrentProject
    );


    $("#downloadBtn")?.addEventListener(
      "click",
      downloadCurrentProject
    );


    /* Template select */

    $("#projectTemplate")?.addEventListener(
      "change",
      (event) => {
        renderTemplateChoices(
          event.target.value
        );
      }
    );


    /* Template cards */

    $("#templateChoices")?.addEventListener(
      "click",
      (event) => {

        const choice =
          event.target.closest(
            "[data-template-id]"
          );

        if (!choice) return;

        const templateId =
          choice.dataset.templateId;

        const select =
          $("#projectTemplate");

        if (select) {
          select.value =
            templateId;
        }

        renderTemplateChoices(
          templateId
        );
      }
    );


    /* Menu mobile */

    $("#mobileMenuBtn")?.addEventListener(
      "click",
      () => {
        openMobileMenu();
      }
    );


    /* Fechar menu ao clicar fora */

    document.addEventListener(
      "click",
      (event) => {

        const sidebar =
          $(".sidebar");

        const button =
          $("#mobileMenuBtn");

        if (!sidebar) return;

        if (
          window.innerWidth > 820
        ) {
          return;
        }

        if (
          sidebar.contains(
            event.target
          ) ||
          button?.contains(
            event.target
          )
        ) {
          return;
        }

        closeMobileMenu();
      }
    );

  }


  /* =======================================================
     AUTH STATE
  ======================================================== */

  function bindAuthState() {

    supabaseClient.auth.onAuthStateChange(
      async (_event, session) => {

        if (session?.user) {

          state.user =
            session.user;

          if (
            $("#app")?.classList.contains(
              "hidden"
            )
          ) {
            await enterApp();
          }

          return;
        }

        state.user = null;

        $("#app")?.classList.add(
          "hidden"
        );

        $("#loginScreen")?.classList.remove(
          "hidden"
        );
      }
    );
  }


  /* =======================================================
     INIT
  ======================================================== */

  async function init() {

    bindEvents();

    bindAuthState();

    const session =
      await getSession();

    if (session?.user) {

      state.user =
        session.user;

      await enterApp();

      return;
    }

    $("#loginScreen")?.classList.remove(
      "hidden"
    );

    $("#app")?.classList.add(
      "hidden"
    );
  }


  /* =======================================================
     START
  ======================================================== */

  document.addEventListener(
    "DOMContentLoaded",
    init
  );

})();
