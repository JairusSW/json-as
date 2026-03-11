import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { deserializeStringToField_SWAR } from "../deserialize/swar/string";
import { atoi } from "../util/atoi";
import { bench, blackbox, dumpToFile } from "./lib/bench";

const TRUE_WORD: u64 = 28429475166421108;
const FALSE_WORD: u64 = 32370086184550502;
const NULL_WORD: u64 = 30399761348886638;


@inline
function failParse(): void {
  throw new Error("Failed to parse JSON");
}


@inline
function parseBoolField(srcStart: usize, dstFieldPtr: usize): usize {
  if (load<u64>(srcStart) == TRUE_WORD) {
    store<bool>(dstFieldPtr, true);
    return srcStart + 8;
  }

  if (load<u64>(srcStart) == FALSE_WORD && load<u16>(srcStart, 8) == 101) {
    store<bool>(dstFieldPtr, false);
    return srcStart + 10;
  }

  failParse();
  return srcStart;
}


@inline
function deserializeIntegerField<T extends number>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  let valueEnd = srcStart;
  if (load<u16>(valueEnd) == 45) {
    valueEnd += 2;
    if (valueEnd >= srcEnd) failParse();
  }

  let digit = <u32>load<u16>(valueEnd) - 48;
  if (digit > 9) failParse();
  valueEnd += 2;

  while (valueEnd < srcEnd) {
    digit = <u32>load<u16>(valueEnd) - 48;
    if (digit > 9) break;
    valueEnd += 2;
  }

  store<T>(fieldPtr, atoi<T>(srcStart, valueEnd));
  return valueEnd;
}


@inline
function deserializeNullableStringField(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  if (load<u64>(srcStart) == NULL_WORD) {
    store<string | null>(fieldPtr, changetype<string | null>(0));
    return srcStart + 8;
  }

  return deserializeStringToField_SWAR<string | null>(srcStart, srcEnd, fieldPtr);
}


@inline
function parseStringArray_FAST(srcStart: usize, srcEnd: usize, out: Array<string>): usize {
  if (load<u16>(srcStart) != 91) failParse();

  let index = 0;
  srcStart += 2;

  if (load<u16>(srcStart) == 93) {
    out.length = 0;
    return srcStart + 2;
  }

  while (true) {
    if (index >= out.length) out.push("");
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, out.dataStart + ((<usize>index) << alignof<string>()));
    index++;

    const code = load<u16>(srcStart);
    if (code == 44) {
      srcStart += 2;
      continue;
    }
    if (code == 93) {
      out.length = index;
      return srcStart + 2;
    }
    failParse();
  }
}


@json
class RepoOwner {
  public login!: string;
  public id!: i32;
  public node_id!: string;
  public avatar_url!: string;
  public gravatar_id!: string;
  public url!: string;
  public html_url!: string;
  public followers_url!: string;
  public following_url!: string;
  public gists_url!: string;
  public starred_url!: string;
  public subscriptions_url!: string;
  public organizations_url!: string;
  public repos_url!: string;
  public events_url!: string;
  public received_events_url!: string;
  public type!: string;
  public user_view_type!: string;
  public site_admin!: boolean;
}


@json
class RepoLicense {
  public key!: string;
  public name!: string;
  public spdx_id!: string;
  public url!: string | null;
  public node_id!: string;
}


@json
class Repo {
  public id!: i32;
  public node_id!: string;
  public name!: string;
  public full_name!: string;
  public private!: boolean;
  public owner!: RepoOwner;
  public html_url!: string;
  public description!: string | null;
  public fork!: boolean;
  public url!: string;
  public forks_url!: string;
  public keys_url!: string;
  public collaborators_url!: string;
  public teams_url!: string;
  public hooks_url!: string;
  public issue_events_url!: string;
  public events_url!: string;
  public assignees_url!: string;
  public branches_url!: string;
  public tags_url!: string;
  public blobs_url!: string;
  public git_tags_url!: string;
  public git_refs_url!: string;
  public trees_url!: string;
  public statuses_url!: string;
  public languages_url!: string;
  public stargazers_url!: string;
  public contributors_url!: string;
  public subscribers_url!: string;
  public subscription_url!: string;
  public commits_url!: string;
  public git_commits_url!: string;
  public comments_url!: string;
  public issue_comment_url!: string;
  public contents_url!: string;
  public compare_url!: string;
  public merges_url!: string;
  public archive_url!: string;
  public downloads_url!: string;
  public issues_url!: string;
  public pulls_url!: string;
  public milestones_url!: string;
  public notifications_url!: string;
  public labels_url!: string;
  public releases_url!: string;
  public deployments_url!: string;
  public created_at!: string;
  public updated_at!: string;
  public pushed_at!: string;
  public git_url!: string;
  public ssh_url!: string;
  public clone_url!: string;
  public svn_url!: string;
  public homepage!: string | null;
  public size!: i32;
  public stargazers_count!: i32;
  public watchers_count!: i32;
  public language!: string | null;
  public has_issues!: boolean;
  public has_projects!: boolean;
  public has_downloads!: boolean;
  public has_wiki!: boolean;
  public has_pages!: boolean;
  public has_discussions!: boolean;
  public forks_count!: i32;
  public mirror_url!: string | null;
  public archived!: boolean;
  public disabled!: boolean;
  public open_issues_count!: i32;
  public license!: RepoLicense | null;
  public allow_forking!: boolean;
  public is_template!: boolean;
  public web_commit_signoff_required!: boolean;
  public topics!: string[];
  public visibility!: string;
  public forks!: i32;
  public open_issues!: i32;
  public watchers!: i32;
  public default_branch!: string;


  @inline
  __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): usize {
    const dst = changetype<usize>(out);

    do {
      if (load<u64>(srcStart, 0) != 28147948644860027 || load<u32>(srcStart, 8) != 3801122) break;
      srcStart += 12;
      srcStart = deserializeIntegerField<i32>(srcStart, srcEnd, dst + offsetof<this>("id"));

      if (load<u64>(srcStart, 0) != 31244194863513644 || load<u64>(srcStart, 8) != 29555280583131236 || load<u32>(srcStart, 16) != 2228324 || load<u16>(srcStart, 20) != 58) break;
      srcStart += 22;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("node_id"));

      if (load<u64>(srcStart, 0) != 27303545189564460 || load<u64>(srcStart, 8) != 16325694684725357) break;
      srcStart += 16;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("name"));

      if (load<u64>(srcStart, 0) != 32933010364039212 || load<u64>(srcStart, 8) != 30962655467143276 || load<u64>(srcStart, 16) != 9570583007002721 || load<u16>(srcStart, 24) != 58) break;
      srcStart += 26;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("full_name"));

      if (load<u64>(srcStart, 0) != 32088628383580204 || load<u64>(srcStart, 8) != 32651513917997161 || load<u32>(srcStart, 16) != 2228325 || load<u16>(srcStart, 20) != 58) break;
      srcStart += 22;
      srcStart = parseBoolField(srcStart, dst + offsetof<this>("private"));

      if (load<u64>(srcStart, 0) != 33495998972166188 || load<u64>(srcStart, 8) != 9570638841053294 || load<u16>(srcStart, 16) != 58) break;
      srcStart += 18;
      {
        let value = load<RepoOwner>(dst + offsetof<this>("owner"));
        if (changetype<usize>(value) == 0) {
          value = changetype<RepoOwner>(__new(offsetof<nonnull<RepoOwner>>(), idof<nonnull<RepoOwner>>()));
          store<RepoOwner>(dst + offsetof<this>("owner"), value);
        }
        srcStart = changetype<nonnull<RepoOwner>>(value).__DESERIALIZE<RepoOwner>(srcStart, srcEnd, value);
      }

      if (load<u64>(srcStart, 0) != 32651543977263148 || load<u64>(srcStart, 8) != 32932980304117869 || load<u64>(srcStart, 16) != 16325694685184114) break;
      srcStart += 24;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("html_url"));

      if (load<u64>(srcStart, 0) != 28429402146734124 || load<u64>(srcStart, 8) != 29555362187378803 || load<u64>(srcStart, 16) != 31244173394051184 || load<u32>(srcStart, 24) != 2228334 || load<u16>(srcStart, 28) != 58) break;
      srcStart += 30;
      srcStart = deserializeNullableStringField(srcStart, srcEnd, dst + offsetof<this>("description"));

      if (load<u64>(srcStart, 0) != 31244160503775276 || load<u64>(srcStart, 8) != 16325694685118578) break;
      srcStart += 16;
      srcStart = parseBoolField(srcStart, dst + offsetof<this>("fork"));

      if (load<u64>(srcStart, 0) != 32088649858416684 || load<u32>(srcStart, 8) != 2228332 || load<u16>(srcStart, 12) != 58) break;
      srcStart += 14;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("url"));

      if (load<u64>(srcStart, 0) != 31244160503775276 || load<u64>(srcStart, 8) != 26740616715763826 || load<u64>(srcStart, 16) != 9570613072101493 || load<u16>(srcStart, 24) != 58) break;
      srcStart += 26;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("forks_url"));

      if (load<u64>(srcStart, 0) != 28429432211505196 || load<u64>(srcStart, 8) != 32932980304576633 || load<u64>(srcStart, 16) != 16325694685184114) break;
      srcStart += 24;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("keys_url"));

      if (load<u64>(srcStart, 0) != 31244147618873388 || load<u64>(srcStart, 8) != 27584964336549996 || load<u64>(srcStart, 16) != 32651513917735023 || load<u64>(srcStart, 24) != 26740616716222575 || load<u64>(srcStart, 32) != 9570613072101493 || load<u16>(srcStart, 40) != 58) break;
      srcStart += 42;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("collaborators_url"));

      if (load<u64>(srcStart, 0) != 28429470866210860 || load<u64>(srcStart, 8) != 26740616715894881 || load<u64>(srcStart, 16) != 9570613072101493 || load<u16>(srcStart, 24) != 58) break;
      srcStart += 26;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("teams_url"));

      if (load<u64>(srcStart, 0) != 31244169093709868 || load<u64>(srcStart, 8) != 26740616715763823 || load<u64>(srcStart, 16) != 9570613072101493 || load<u16>(srcStart, 24) != 58) break;
      srcStart += 26;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("hooks_url"));

      if (load<u64>(srcStart, 0) != 32370073295519788 || load<u64>(srcStart, 8) != 26740556586877043 || load<u64>(srcStart, 16) != 30962681237602405 || load<u64>(srcStart, 24) != 32932980304576628 || load<u64>(srcStart, 32) != 16325694685184114) break;
      srcStart += 40;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("issue_events_url"));

      if (load<u64>(srcStart, 0) != 33214481045782572 || load<u64>(srcStart, 8) != 32370120545140837 || load<u64>(srcStart, 16) != 30399787118690399 || load<u32>(srcStart, 24) != 3801122) break;
      srcStart += 28;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("events_url"));

      if (load<u64>(srcStart, 0) != 32370038935781420 || load<u64>(srcStart, 8) != 30962689826685043 || load<u64>(srcStart, 16) != 26740616715370597 || load<u64>(srcStart, 24) != 9570613072101493 || load<u16>(srcStart, 32) != 58) break;
      srcStart += 34;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("assignees_url"));

      if (load<u64>(srcStart, 0) != 32088568254038060 || load<u64>(srcStart, 8) != 29273822786879585 || load<u64>(srcStart, 16) != 32932980304576613 || load<u64>(srcStart, 24) != 16325694685184114) break;
      srcStart += 32;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("branches_url"));

      if (load<u64>(srcStart, 0) != 27303570959368236 || load<u64>(srcStart, 8) != 32932980304576615 || load<u64>(srcStart, 16) != 16325694685184114) break;
      srcStart += 24;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("tags_url"));

      if (load<u64>(srcStart, 0) != 30399718393774124 || load<u64>(srcStart, 8) != 26740616715173999 || load<u64>(srcStart, 16) != 9570613072101493 || load<u16>(srcStart, 24) != 58) break;
      srcStart += 26;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("blobs_url"));

      if (load<u64>(srcStart, 0) != 29555314938478636 || load<u64>(srcStart, 8) != 27303570963366004 || load<u64>(srcStart, 16) != 32932980304576615 || load<u64>(srcStart, 24) != 16325694685184114) break;
      srcStart += 32;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("git_tags_url"));

      if (load<u64>(srcStart, 0) != 29555314938478636 || load<u64>(srcStart, 8) != 28429462280274036 || load<u64>(srcStart, 16) != 32932980304576614 || load<u64>(srcStart, 24) != 16325694685184114) break;
      srcStart += 32;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("git_refs_url"));

      if (load<u64>(srcStart, 0) != 32088645563449388 || load<u64>(srcStart, 8) != 26740616715370597 || load<u64>(srcStart, 16) != 9570613072101493 || load<u16>(srcStart, 24) != 58) break;
      srcStart += 26;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("trees_url"));

      if (load<u64>(srcStart, 0) != 32651591221903404 || load<u64>(srcStart, 8) != 32370124840501345 || load<u64>(srcStart, 16) != 32932980304576613 || load<u64>(srcStart, 24) != 16325694685184114) break;
      srcStart += 32;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("statuses_url"));

      if (load<u64>(srcStart, 0) != 27303536599629868 || load<u64>(srcStart, 8) != 27303575258857582 || load<u64>(srcStart, 16) != 26740616715370599 || load<u64>(srcStart, 24) != 9570613072101493 || load<u16>(srcStart, 32) != 58) break;
      srcStart += 34;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("languages_url"));

      if (load<u64>(srcStart, 0) != 32651591221903404 || load<u64>(srcStart, 8) != 27303515130036321 || load<u64>(srcStart, 16) != 32370111954616442 || load<u64>(srcStart, 24) != 30399787118690399 || load<u32>(srcStart, 32) != 3801122) break;
      srcStart += 36;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("stargazers_url"));

      if (load<u64>(srcStart, 0) != 31244147618873388 || load<u64>(srcStart, 8) != 29555362188492910 || load<u64>(srcStart, 16) != 31244220638756962 || load<u64>(srcStart, 24) != 32932980304576626 || load<u64>(srcStart, 32) != 16325694685184114) break;
      srcStart += 40;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("contributors_url"));

      if (load<u64>(srcStart, 0) != 32933066198614060 || load<u64>(srcStart, 8) != 32088572554313826 || load<u64>(srcStart, 16) != 32088581143134313 || load<u64>(srcStart, 24) != 32088649862414451 || load<u32>(srcStart, 32) != 2228332 || load<u16>(srcStart, 36) != 58) break;
      srcStart += 38;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("subscribers_url"));

      if (load<u64>(srcStart, 0) != 32933066198614060 || load<u64>(srcStart, 8) != 32088572554313826 || load<u64>(srcStart, 16) != 29555370778165353 || load<u64>(srcStart, 24) != 32932980304248943 || load<u64>(srcStart, 32) != 16325694685184114) break;
      srcStart += 40;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("subscription_url"));

      if (load<u64>(srcStart, 0) != 31244147618873388 || load<u64>(srcStart, 8) != 32651548277145709 || load<u64>(srcStart, 16) != 32088649862414451 || load<u32>(srcStart, 24) != 2228332 || load<u16>(srcStart, 28) != 58) break;
      srcStart += 30;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("commits_url"));

      if (load<u64>(srcStart, 0) != 29555314938478636 || load<u64>(srcStart, 8) != 31244147622871156 || load<u64>(srcStart, 16) != 32651548277145709 || load<u64>(srcStart, 24) != 32088649862414451 || load<u32>(srcStart, 32) != 2228332 || load<u16>(srcStart, 36) != 58) break;
      srcStart += 38;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("git_commits_url"));

      if (load<u64>(srcStart, 0) != 31244147618873388 || load<u64>(srcStart, 8) != 30962681237012589 || load<u64>(srcStart, 16) != 32932980304576628 || load<u64>(srcStart, 24) != 16325694685184114) break;
      srcStart += 32;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("comments_url"));

      if (load<u64>(srcStart, 0) != 32370073295519788 || load<u64>(srcStart, 8) != 26740556586877043 || load<u64>(srcStart, 16) != 30681240620171363 || load<u64>(srcStart, 24) != 26740621010927717 || load<u64>(srcStart, 32) != 9570613072101493 || load<u16>(srcStart, 40) != 58) break;
      srcStart += 42;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("issue_comment_url"));

      if (load<u64>(srcStart, 0) != 31244147618873388 || load<u64>(srcStart, 8) != 30962681237471342 || load<u64>(srcStart, 16) != 32932980304576628 || load<u64>(srcStart, 24) != 16325694685184114) break;
      srcStart += 32;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("contents_url"));

      if (load<u64>(srcStart, 0) != 31244147618873388 || load<u64>(srcStart, 8) != 32088563964182637 || load<u64>(srcStart, 16) != 32088649862414437 || load<u32>(srcStart, 24) != 2228332 || load<u16>(srcStart, 28) != 58) break;
      srcStart += 30;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("compare_url"));

      if (load<u64>(srcStart, 0) != 28429440801439788 || load<u64>(srcStart, 8) != 32370056120172658 || load<u64>(srcStart, 16) != 30399787118690399 || load<u32>(srcStart, 24) != 3801122) break;
      srcStart += 28;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("merges_url"));

      if (load<u64>(srcStart, 0) != 32088563959070764 || load<u64>(srcStart, 8) != 33214498230239331 || load<u64>(srcStart, 16) != 32088649862414437 || load<u32>(srcStart, 24) != 2228332 || load<u16>(srcStart, 28) != 58) break;
      srcStart += 30;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("archive_url"));

      if (load<u64>(srcStart, 0) != 31244151913840684 || load<u64>(srcStart, 8) != 31244186278559863 || load<u64>(srcStart, 16) != 26740616715305057 || load<u64>(srcStart, 24) != 9570613072101493 || load<u16>(srcStart, 32) != 58) break;
      srcStart += 34;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("downloads_url"));

      if (load<u64>(srcStart, 0) != 32370073295519788 || load<u64>(srcStart, 8) != 32370056121090163 || load<u64>(srcStart, 16) != 30399787118690399 || load<u32>(srcStart, 24) != 3801122) break;
      srcStart += 28;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("issues_url"));

      if (load<u64>(srcStart, 0) != 32933053313712172 || load<u64>(srcStart, 8) != 26740616715829356 || load<u64>(srcStart, 16) != 9570613072101493 || load<u16>(srcStart, 24) != 58) break;
      srcStart += 26;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("pulls_url"));

      if (load<u64>(srcStart, 0) != 29555340708282412 || load<u64>(srcStart, 8) != 32651591226294380 || load<u64>(srcStart, 16) != 32370056120631407 || load<u64>(srcStart, 24) != 30399787118690399 || load<u32>(srcStart, 32) != 3801122) break;
      srcStart += 36;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("milestones_url"));

      if (load<u64>(srcStart, 0) != 31244194863513644 || load<u64>(srcStart, 8) != 29555310648164468 || load<u64>(srcStart, 16) != 29555370777182307 || load<u64>(srcStart, 24) != 26740616715960431 || load<u64>(srcStart, 32) != 9570613072101493 || load<u16>(srcStart, 40) != 58) break;
      srcStart += 42;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("notifications_url"));

      if (load<u64>(srcStart, 0) != 27303536599629868 || load<u64>(srcStart, 8) != 32370086184812642 || load<u64>(srcStart, 16) != 30399787118690399 || load<u32>(srcStart, 24) != 3801122) break;
      srcStart += 28;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("labels_url"));

      if (load<u64>(srcStart, 0) != 28429462276276268 || load<u64>(srcStart, 8) != 32370038940172396 || load<u64>(srcStart, 16) != 32932980304576613 || load<u64>(srcStart, 24) != 16325694685184114) break;
      srcStart += 32;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("releases_url"));

      if (load<u64>(srcStart, 0) != 28429402146734124 || load<u64>(srcStart, 8) != 34058948930437232 || load<u64>(srcStart, 16) != 32651569751457901 || load<u64>(srcStart, 24) != 32088649862414451 || load<u32>(srcStart, 32) != 2228332 || load<u16>(srcStart, 36) != 58) break;
      srcStart += 38;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("deployments_url"));

      if (load<u64>(srcStart, 0) != 32088572549005356 || load<u64>(srcStart, 8) != 28429470870339685 || load<u64>(srcStart, 16) != 32651513916489828 || load<u32>(srcStart, 24) != 3801122) break;
      srcStart += 28;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("created_at"));

      if (load<u64>(srcStart, 0) != 31525699904995372 || load<u64>(srcStart, 8) != 28429470870339684 || load<u64>(srcStart, 16) != 32651513916489828 || load<u32>(srcStart, 24) != 3801122) break;
      srcStart += 28;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("updated_at"));

      if (load<u64>(srcStart, 0) != 32933053313712172 || load<u64>(srcStart, 8) != 28147931469578355 || load<u64>(srcStart, 16) != 9570647430725727 || load<u16>(srcStart, 24) != 58) break;
      srcStart += 26;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("pushed_at"));

      if (load<u64>(srcStart, 0) != 29555314938478636 || load<u64>(srcStart, 8) != 32088649862414452 || load<u32>(srcStart, 16) != 2228332 || load<u16>(srcStart, 20) != 58) break;
      srcStart += 22;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("git_url"));

      if (load<u64>(srcStart, 0) != 32370116245192748 || load<u64>(srcStart, 8) != 32088649862414440 || load<u32>(srcStart, 16) != 2228332 || load<u16>(srcStart, 20) != 58) break;
      srcStart += 22;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("ssh_url"));

      if (load<u64>(srcStart, 0) != 30399722688741420 || load<u64>(srcStart, 8) != 26740556586418287 || load<u64>(srcStart, 16) != 9570613072101493 || load<u16>(srcStart, 24) != 58) break;
      srcStart += 26;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("clone_url"));

      if (load<u64>(srcStart, 0) != 33214541175324716 || load<u64>(srcStart, 8) != 32088649862414446 || load<u32>(srcStart, 16) != 2228332 || load<u16>(srcStart, 20) != 58) break;
      srcStart += 22;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("svn_url"));

      if (load<u64>(srcStart, 0) != 31244169093709868 || load<u64>(srcStart, 8) != 27303553783890029 || load<u64>(srcStart, 16) != 16325694684725351) break;
      srcStart += 24;
      srcStart = deserializeNullableStringField(srcStart, srcEnd, dst + offsetof<this>("homepage"));

      if (load<u64>(srcStart, 0) != 29555366478086188 || load<u64>(srcStart, 8) != 16325694684725370) break;
      srcStart += 16;
      srcStart = deserializeIntegerField<i32>(srcStart, srcEnd, dst + offsetof<this>("size"));

      if (load<u64>(srcStart, 0) != 32651591221903404 || load<u64>(srcStart, 8) != 27303515130036321 || load<u64>(srcStart, 16) != 32370111954616442 || load<u64>(srcStart, 24) != 32933049023004767 || load<u64>(srcStart, 32) != 16325694685708398) break;
      srcStart += 40;
      srcStart = deserializeIntegerField<i32>(srcStart, srcEnd, dst + offsetof<this>("stargazers_count"));

      if (load<u64>(srcStart, 0) != 27303583844270124 || load<u64>(srcStart, 8) != 28429419330863220 || load<u64>(srcStart, 16) != 27866430723784818 || load<u64>(srcStart, 24) != 32651569752506479 || load<u32>(srcStart, 32) != 3801122) break;
      srcStart += 36;
      srcStart = deserializeIntegerField<i32>(srcStart, srcEnd, dst + offsetof<this>("watchers_count"));

      if (load<u64>(srcStart, 0) != 27303536599629868 || load<u64>(srcStart, 8) != 27303575258857582 || load<u64>(srcStart, 16) != 16325694684725351) break;
      srcStart += 24;
      srcStart = deserializeNullableStringField(srcStart, srcEnd, dst + offsetof<this>("language"));

      if (load<u64>(srcStart, 0) != 27303519419760684 || load<u64>(srcStart, 8) != 32370073299517555 || load<u64>(srcStart, 16) != 32370056121090163 || load<u32>(srcStart, 24) != 3801122) break;
      srcStart += 28;
      srcStart = parseBoolField(srcStart, dst + offsetof<this>("has_issues"));

      if (load<u64>(srcStart, 0) != 27303519419760684 || load<u64>(srcStart, 8) != 32088628387577971 || load<u64>(srcStart, 16) != 27866456492998767 || load<u64>(srcStart, 24) != 16325694685642868) break;
      srcStart += 32;
      srcStart = parseBoolField(srcStart, dst + offsetof<this>("has_projects"));

      if (load<u64>(srcStart, 0) != 27303519419760684 || load<u64>(srcStart, 8) != 31244151917838451 || load<u64>(srcStart, 16) != 31244186278559863 || load<u64>(srcStart, 24) != 9570643135955041 || load<u16>(srcStart, 32) != 58) break;
      srcStart += 34;
      srcStart = parseBoolField(srcStart, dst + offsetof<this>("has_downloads"));

      if (load<u64>(srcStart, 0) != 27303519419760684 || load<u64>(srcStart, 8) != 29555383661953139 || load<u64>(srcStart, 16) != 16325694684987499) break;
      srcStart += 24;
      srcStart = parseBoolField(srcStart, dst + offsetof<this>("has_wiki"));

      if (load<u64>(srcStart, 0) != 27303519419760684 || load<u64>(srcStart, 8) != 27303553783496819 || load<u64>(srcStart, 16) != 9570643136020583 || load<u16>(srcStart, 24) != 58) break;
      srcStart += 26;
      srcStart = parseBoolField(srcStart, dst + offsetof<this>("has_pages"));

      if (load<u64>(srcStart, 0) != 27303519419760684 || load<u64>(srcStart, 8) != 29555302057574515 || load<u64>(srcStart, 16) != 32370124839387251 || load<u64>(srcStart, 24) != 30962724186423411 || load<u32>(srcStart, 32) != 2228339 || load<u16>(srcStart, 36) != 58) break;
      srcStart += 38;
      srcStart = parseBoolField(srcStart, dst + offsetof<this>("has_discussions"));

      if (load<u64>(srcStart, 0) != 31244160503775276 || load<u64>(srcStart, 8) != 26740616715763826 || load<u64>(srcStart, 16) != 30962749956620387 || load<u32>(srcStart, 24) != 2228340 || load<u16>(srcStart, 28) != 58) break;
      srcStart += 30;
      srcStart = deserializeIntegerField<i32>(srcStart, srcEnd, dst + offsetof<this>("forks_count"));

      if (load<u64>(srcStart, 0) != 29555340708282412 || load<u64>(srcStart, 8) != 32088624093855858 || load<u64>(srcStart, 16) != 30399787118690399 || load<u32>(srcStart, 24) != 3801122) break;
      srcStart += 28;
      srcStart = deserializeNullableStringField(srcStart, srcEnd, dst + offsetof<this>("mirror_url"));

      if (load<u64>(srcStart, 0) != 32088563959070764 || load<u64>(srcStart, 8) != 33214498230239331 || load<u64>(srcStart, 16) != 16325694684659813) break;
      srcStart += 24;
      srcStart = parseBoolField(srcStart, dst + offsetof<this>("archived"));

      if (load<u64>(srcStart, 0) != 29555302053576748 || load<u64>(srcStart, 8) != 30399718397902963 || load<u64>(srcStart, 16) != 16325694684659813) break;
      srcStart += 24;
      srcStart = parseBoolField(srcStart, dst + offsetof<this>("disabled"));

      if (load<u64>(srcStart, 0) != 31525674135191596 || load<u64>(srcStart, 8) != 29555280583721061 || load<u64>(srcStart, 16) != 28429475166486643 || load<u64>(srcStart, 24) != 31244147622871155 || load<u64>(srcStart, 32) != 9570647431577717 || load<u16>(srcStart, 40) != 58) break;
      srcStart += 42;
      srcStart = deserializeIntegerField<i32>(srcStart, srcEnd, dst + offsetof<this>("open_issues_count"));

      if (load<u64>(srcStart, 0) != 29555336413315116 || load<u64>(srcStart, 8) != 32370094774747235 || load<u32>(srcStart, 16) != 2228325 || load<u16>(srcStart, 20) != 58) break;
      srcStart += 22;
      if (load<u64>(srcStart) == NULL_WORD) {
        store<RepoLicense>(dst + offsetof<this>("license"), changetype<RepoLicense>(0));
        srcStart += 8;
      } else {
        let value = load<RepoLicense>(dst + offsetof<this>("license"));
        if (changetype<usize>(value) == 0) {
          value = changetype<RepoLicense>(__new(offsetof<nonnull<RepoLicense>>(), idof<nonnull<RepoLicense>>()));
          store<RepoLicense>(dst + offsetof<this>("license"), value);
        }
        srcStart = changetype<nonnull<RepoLicense>>(value).__DESERIALIZE<RepoLicense>(srcStart, srcEnd, value);
      }

      if (load<u64>(srcStart, 0) != 30399714098806828 || load<u64>(srcStart, 8) != 26740633895895148 || load<u64>(srcStart, 16) != 30118312141586534 || load<u64>(srcStart, 24) != 9570591597002857 || load<u16>(srcStart, 32) != 58) break;
      srcStart += 34;
      srcStart = parseBoolField(srcStart, dst + offsetof<this>("allow_forking"));

      if (load<u64>(srcStart, 0) != 32370073295519788 || load<u64>(srcStart, 8) != 30681206260760671 || load<u64>(srcStart, 16) != 32651513917341808 || load<u32>(srcStart, 24) != 2228325 || load<u16>(srcStart, 28) != 58) break;
      srcStart += 30;
      srcStart = parseBoolField(srcStart, dst + offsetof<this>("is_template"));

      if (load<u64>(srcStart, 0) != 28429483751112748 || load<u64>(srcStart, 8) != 31244147622871138 || load<u64>(srcStart, 16) != 32651548277145709 || load<u64>(srcStart, 24) != 28992373580300383 || load<u64>(srcStart, 32) != 28710885718425710 || load<u64>(srcStart, 40) != 31807106167472223 || load<u64>(srcStart, 48) != 28429462280929397 || load<u32>(srcStart, 56) != 2228324 || load<u16>(srcStart, 60) != 58) break;
      srcStart += 62;
      srcStart = parseBoolField(srcStart, dst + offsetof<this>("web_commit_signoff_required"));

      if (load<u64>(srcStart, 0) != 31244220633317420 || load<u64>(srcStart, 8) != 32370047530369136 || load<u32>(srcStart, 16) != 3801122) break;
      srcStart += 20;
      {
        let value = load<Array<string>>(dst + offsetof<this>("topics"));
        if (changetype<usize>(value) == 0) {
          value = [];
          store<Array<string>>(dst + offsetof<this>("topics"), value);
        }
        srcStart = parseStringArray_FAST(srcStart, srcEnd, value);
      }

      if (load<u64>(srcStart, 0) != 29555379362988076 || load<u64>(srcStart, 8) != 29555293468295283 || load<u64>(srcStart, 16) != 34058970405077100 || load<u32>(srcStart, 24) != 3801122) break;
      srcStart += 28;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("visibility"));

      if (load<u64>(srcStart, 0) != 31244160503775276 || load<u64>(srcStart, 8) != 9570643136413810 || load<u16>(srcStart, 16) != 58) break;
      srcStart += 18;
      srcStart = deserializeIntegerField<i32>(srcStart, srcEnd, dst + offsetof<this>("forks"));

      if (load<u64>(srcStart, 0) != 31525674135191596 || load<u64>(srcStart, 8) != 29555280583721061 || load<u64>(srcStart, 16) != 28429475166486643 || load<u32>(srcStart, 24) != 2228339 || load<u16>(srcStart, 28) != 58) break;
      srcStart += 30;
      srcStart = deserializeIntegerField<i32>(srcStart, srcEnd, dst + offsetof<this>("open_issues"));

      if (load<u64>(srcStart, 0) != 27303583844270124 || load<u64>(srcStart, 8) != 28429419330863220 || load<u64>(srcStart, 16) != 16325694685642866) break;
      srcStart += 24;
      srcStart = deserializeIntegerField<i32>(srcStart, srcEnd, dst + offsetof<this>("watchers"));

      if (load<u64>(srcStart, 0) != 28429402146734124 || load<u64>(srcStart, 8) != 30399800002281574 || load<u64>(srcStart, 16) != 32088568258035828 || load<u64>(srcStart, 24) != 29273822786879585 || load<u32>(srcStart, 32) != 3801122) break;
      srcStart += 36;
      srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("default_branch"));

      if (load<u16>(srcStart) != 125) break;
      return srcStart + 2;
    } while (false);

    failParse();
    return srcStart;
  }
}

// Create instances and assign fields directly
const v1 = new Repo();
const owner = new RepoOwner();

owner.login = "octocat";
owner.id = 583231;
owner.node_id = "MDQ6VXNlcjU4MzIzMQ==";
owner.avatar_url = "https://avatars.githubusercontent.com/u/583231?v=4";
owner.gravatar_id = "";
owner.url = "https://api.github.com/users/octocat";
owner.html_url = "https://github.com/octocat";
owner.followers_url = "https://api.github.com/users/octocat/followers";
owner.following_url = "https://api.github.com/users/octocat/following{/other_user}";
owner.gists_url = "https://api.github.com/users/octocat/gists{/gist_id}";
owner.starred_url = "https://api.github.com/users/octocat/starred{/owner}{/repo}";
owner.subscriptions_url = "https://api.github.com/users/octocat/subscriptions";
owner.organizations_url = "https://api.github.com/users/octocat/orgs";
owner.repos_url = "https://api.github.com/users/octocat/repos";
owner.events_url = "https://api.github.com/users/octocat/events{/privacy}";
owner.received_events_url = "https://api.github.com/users/octocat/received_events";
owner.type = "User";
owner.user_view_type = "public";
owner.site_admin = false;

v1.owner = owner;

v1.id = 132935648;
v1.node_id = "MDEwOlJlcG9zaXRvcnkxMzI5MzU2NDg=";
v1.name = "boysenberry-repo-1";
v1.full_name = "octocat/boysenberry-repo-1";
v1.private = true;
v1.html_url = "https://github.com/octocat/boysenberry-repo-1";
v1.description = "Testing";
v1.fork = true;
v1.url = "https://api.github.com/repos/octocat/boysenberry-repo-1";
v1.forks_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/forks";
v1.keys_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/keys{/key_id}";
v1.collaborators_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/collaborators{/collaborator}";
v1.teams_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/teams";
v1.hooks_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/hooks";
v1.issue_events_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/issues/events{/number}";
v1.events_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/events";
v1.assignees_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/assignees{/user}";
v1.branches_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/branches{/branch}";
v1.tags_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/tags";
v1.blobs_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/blobs{/sha}";
v1.git_tags_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/tags{/sha}";
v1.git_refs_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/refs{/sha}";
v1.trees_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/trees{/sha}";
v1.statuses_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/statuses/{sha}";
v1.languages_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/languages";
v1.stargazers_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/stargazers";
v1.contributors_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/contributors";
v1.subscribers_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/subscribers";
v1.subscription_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/subscription";
v1.commits_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/commits{/sha}";
v1.git_commits_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/commits{/sha}";
v1.comments_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/comments{/number}";
v1.issue_comment_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/issues/comments{/number}";
v1.contents_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/contents/{+path}";
v1.compare_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/compare/{base}...{head}";
v1.merges_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/merges";
v1.archive_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/{archive_format}{/ref}";
v1.downloads_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/downloads";
v1.issues_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/issues{/number}";
v1.pulls_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/pulls{/number}";
v1.milestones_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/milestones{/number}";
v1.notifications_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/notifications{?since,all,participating}";
v1.labels_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/labels{/name}";
v1.releases_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/releases{/id}";
v1.deployments_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/deployments";
v1.created_at = "2018-05-10T17:51:29Z";
v1.updated_at = "2025-05-24T02:01:19Z";
v1.pushed_at = "2024-05-26T07:02:05Z";
v1.git_url = "git://github.com/octocat/boysenberry-repo-1.git";
v1.ssh_url = "git@github.com:octocat/boysenberry-repo-1.git";
v1.clone_url = "https://github.com/octocat/boysenberry-repo-1.git";
v1.svn_url = "https://github.com/octocat/boysenberry-repo-1";
v1.homepage = "";
v1.size = 4;
v1.stargazers_count = 332;
v1.watchers_count = 332;
v1.language = null;
v1.has_issues = false;
v1.has_projects = true;
v1.has_downloads = true;
v1.has_wiki = true;
v1.has_pages = false;
v1.has_discussions = false;
v1.forks_count = 20;
v1.mirror_url = null;
v1.archived = false;
v1.disabled = false;
v1.open_issues_count = 1;
v1.license = null;
v1.allow_forking = true;
v1.is_template = false;
v1.web_commit_signoff_required = false;
v1.topics = [];
v1.visibility = "public";
v1.forks = 20;
v1.open_issues = 1;
v1.watchers = 332;
v1.default_branch = "master";

const v2 = `{"id":132935648,"node_id":"MDEwOlJlcG9zaXRvcnkxMzI5MzU2NDg=","name":"boysenberry-repo-1","full_name":"octocat/boysenberry-repo-1","private":true,"owner":{"login":"octocat","id":583231,"node_id":"MDQ6VXNlcjU4MzIzMQ==","avatar_url":"https://avatars.githubusercontent.com/u/583231?v=4","gravatar_id":"","url":"https://api.github.com/users/octocat","html_url":"https://github.com/octocat","followers_url":"https://api.github.com/users/octocat/followers","following_url":"https://api.github.com/users/octocat/following{/other_user}","gists_url":"https://api.github.com/users/octocat/gists{/gist_id}","starred_url":"https://api.github.com/users/octocat/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/octocat/subscriptions","organizations_url":"https://api.github.com/users/octocat/orgs","repos_url":"https://api.github.com/users/octocat/repos","events_url":"https://api.github.com/users/octocat/events{/privacy}","received_events_url":"https://api.github.com/users/octocat/received_events","type":"User","user_view_type":"public","site_admin":false},"html_url":"https://github.com/octocat/boysenberry-repo-1","description":"Testing","fork":true,"url":"https://api.github.com/repos/octocat/boysenberry-repo-1","forks_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/forks","keys_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/keys{/key_id}","collaborators_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/collaborators{/collaborator}","teams_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/teams","hooks_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/hooks","issue_events_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues/events{/number}","events_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/events","assignees_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/assignees{/user}","branches_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/branches{/branch}","tags_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/tags","blobs_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/blobs{/sha}","git_tags_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/tags{/sha}","git_refs_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/refs{/sha}","trees_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/trees{/sha}","statuses_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/statuses/{sha}","languages_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/languages","stargazers_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/stargazers","contributors_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/contributors","subscribers_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/subscribers","subscription_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/subscription","commits_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/commits{/sha}","git_commits_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/commits{/sha}","comments_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/comments{/number}","issue_comment_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues/comments{/number}","contents_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/contents/{+path}","compare_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/compare/{base}...{head}","merges_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/merges","archive_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/{archive_format}{/ref}","downloads_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/downloads","issues_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues{/number}","pulls_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/pulls{/number}","milestones_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/milestones{/number}","notifications_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/notifications{?since,all,participating}","labels_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/labels{/name}","releases_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/releases{/id}","deployments_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/deployments","created_at":"2018-05-10T17:51:29Z","updated_at":"2025-05-24T02:01:19Z","pushed_at":"2024-05-26T07:02:05Z","git_url":"git://github.com/octocat/boysenberry-repo-1.git","ssh_url":"git@github.com:octocat/boysenberry-repo-1.git","clone_url":"https://github.com/octocat/boysenberry-repo-1.git","svn_url":"https://github.com/octocat/boysenberry-repo-1","homepage":"","size":4,"stargazers_count":332,"watchers_count":332,"language":null,"has_issues":false,"has_projects":true,"has_downloads":true,"has_wiki":true,"has_pages":false,"has_discussions":false,"forks_count":20,"mirror_url":null,"archived":false,"disabled":false,"open_issues_count":1,"license":null,"allow_forking":true,"is_template":false,"web_commit_signoff_required":false,"topics":[],"visibility":"public","forks":20,"open_issues":1,"watchers":332,"default_branch":"master"}`;

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<Repo>(v2))).toBe(v2);

bench(
  "Serialize Large API Response",
  () => {
    blackbox(inline.always(JSON.stringify(v1)));
  },
  10_000,
  10502,
);
dumpToFile("large", "serialize");

bench(
  "Deserialize Large API Response",
  () => {
    blackbox(inline.always(JSON.parse<Repo>(v2)));
  },
  10_000,
  10502,
);
dumpToFile("large", "deserialize");
