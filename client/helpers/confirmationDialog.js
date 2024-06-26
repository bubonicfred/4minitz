import { Util as _ } from "./utils";
import { Blaze } from "meteor/blaze";
import { Template } from "meteor/templating";
import { i18n } from "meteor/universe:i18n";

const DIALOG_TEMPLATE = Template.confirmationDialog;

export class ConfirmationDialog {
  constructor(options, callbacks = {}) {
    this.options = _.assignIn(
      {
        title: i18n.__("Dialog.ConfirmDelete.title"),
        content: i18n.__("Dialog.ConfirmDelete.body"),
        template: null, // if given, replaces '.modal-body' of DIALOG_TEMPLATE
        templateData: {},
        confirmButtonText: i18n.__("Buttons.delete"),
        confirmButtonType: "btn-danger",
        showCancelButton: true,
      },
      options,
    ); // overwrite above defaults with given options
    this.callback = _.assignIn(
      {
        onSuccess() {},
      },
      callbacks,
    );
    this.dialogTemplate = DIALOG_TEMPLATE;
  }

  setTemplate(template, data = {}) {
    this.options.template = template;
    this.options.templateData = data;
    this.options.content = "";
    return this;
  }

  show() {
    this._renderDialog();
    this._renderContentTemplate();
    this._removeDialogOnHide();
    this._setCallbacks();
    this._makeDialogVisible();
  }

  _renderDialog() {
    const dialogData = this.options;
    this.dialogTmpl = Blaze.renderWithData(
      this.dialogTemplate,
      dialogData,
      document.body,
    );
    this.dialog = this.dialogTmpl.firstNode().querySelector(".modal");
  }

  _renderContentTemplate() {
    const tmplOpt = this.options.template;
    if (tmplOpt) {
      const template =
        typeof tmplOpt === "string" ? Template[tmplOpt] : tmplOpt;
      Blaze.renderWithData(
        template,
        this.options.templateData,
        this.dialog.find(".modal-body").get(0),
      );
    }
  }

  _removeDialogOnHide() {
    this.dialog.on("hidden.bs.modal", () => {
      this.hide();
      if (document.querySelectorAll(".modal:visible").length) {
        document.body.classList.add("modal-open");
      }
    });
  }

  _setCallbacks() {
    this.dialog
      .find("#confirmationDialogOK")
      .off()
      .click(() => {
        this.callback.onSuccess();
        return true;
      });
  }

  _makeDialogVisible() {
    this.dialog.modal("show");
  }

  hide() {
    if (this.dialogTmpl) {
      Blaze.remove(this.dialogTmpl);
    }
  }
}
